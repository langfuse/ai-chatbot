import { kv } from '@vercel/kv'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'
import { Langfuse } from 'langfuse'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ?? ''
})

export async function POST(req: Request) {
  const json = await req.json()
  const { messages, previewToken } = json
  const { id: userId, email: userEmail } = (await auth())?.user

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  if (previewToken) {
    configuration.apiKey = previewToken
  }

  const res = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.7,
    stream: true
  })

  const startTime = new Date()

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
      const title = json.messages[0].content.substring(0, 100)
      const id = json.id ?? nanoid()
      const createdAt = Date.now()
      const path = `/chat/${id}`
      const payload = {
        id,
        title,
        userId,
        createdAt,
        path,
        messages: [
          ...messages,
          {
            content: completion,
            role: 'assistant'
          }
        ]
      }
      const trace = langfuse.trace({
        name: 'chat',
        externalId: `chat:${id}`,
        metadata: {
          userEmail
        },
        userId: userId
      })
      const lfGeneration = trace.generation({
        name: 'chat',
        startTime,
        endTime: new Date(),
        prompt: messages,
        completion,
        model: 'gpt-3.5-turbo',
        modelParameters: {
          temperature: 0.7
        },
        usage: {
          promptTokens: JSON.stringify(messages).length,
          completionTokens: completion.length
        }
      })
      await kv.hmset(`chat:${id}`, payload)
      lfGeneration.event({
        startTime: new Date(),
        name: 'kv-hmset',
        level: 'DEBUG',
        input: {
          key: `chat:${id}`,
          ...payload
        }
      })

      await kv.zadd(`user:chat:${userId}`, {
        score: createdAt,
        member: `chat:${id}`
      })
      lfGeneration.event({
        startTime: new Date(),
        name: 'kv-zadd',
        level: 'DEBUG',
        input: {
          key: `user:chat:${userId}`,
          score: createdAt,
          member: `chat:${id}`
        }
      })

      try {
        await langfuse.flush()
      } catch (e) {
        console.error(JSON.stringify(e))
      }
    }
  })

  return new StreamingTextResponse(stream)
}
