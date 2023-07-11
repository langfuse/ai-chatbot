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

  const chatId = json.id ?? nanoid()

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  if (previewToken) {
    configuration.apiKey = previewToken
  }

  const trace = langfuse.trace({
    name: 'chat',
    externalId: `chat:${chatId}`,
    metadata: {
      userEmail
    },
    userId: `user:${userId}`
  })

  const lfGeneration = trace.generation({
    name: 'chat',
    prompt: messages,
    model: 'gpt-3.5-turbo',
    modelParameters: {
      temperature: 0.7
    }
  })

  const res = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.7,
    stream: true
  })

  const stream = OpenAIStream(res, {
    async onStart() {
      lfGeneration.update({
        completionStartTime: new Date()
      })
    },
    async onCompletion(completion) {
      lfGeneration.update({
        endTime: new Date(),
        completion,
        usage: {
          promptTokens: JSON.stringify(messages).length,
          completionTokens: completion.length
        }
      })

      const title = json.messages[0].content.substring(0, 100)
      const createdAt = Date.now()
      const path = `/chat/${chatId}`
      const payload = {
        id: chatId,
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
      await kv.hmset(`chat:${chatId}`, payload)
      lfGeneration.event({
        startTime: new Date(),
        name: 'kv-hmset',
        level: 'DEBUG',
        input: {
          key: `chat:${chatId}`,
          ...payload
        }
      })

      await kv.zadd(`user:chat:${userId}`, {
        score: createdAt,
        member: `chat:${chatId}`
      })
      lfGeneration.event({
        startTime: new Date(),
        name: 'kv-zadd',
        level: 'DEBUG',
        input: {
          key: `user:chat:${userId}`,
          score: createdAt,
          member: `chat:${chatId}`
        }
      })

      try {
        await langfuse.flush()
      } catch (e) {
        console.error(JSON.stringify(e))
      }
    }
  })

  return new StreamingTextResponse(stream, {
    headers: {
      'X-langfuse-generation-id': lfGeneration.id
    }
  })
}
