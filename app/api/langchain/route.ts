import Langfuse from 'langfuse'
import { Configuration, OpenAIApi } from 'openai-edge'
import CallbackHandler from 'langfuse-langchain'

import { OpenAI } from 'langchain/llms/openai'
import { PromptTemplate } from 'langchain/prompts'
import { LLMChain } from 'langchain/chains'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  const langfuseHandler = new CallbackHandler({
    secretKey: 'sk-lf-...',
    publicKey: 'pk-lf-...',
    baseUrl: 'http://localhost:3000/'
  })
  const model = new OpenAI({
    temperature: 0,
    openAIApiKey: 'sk-...'
  })
  const prompt = PromptTemplate.fromTemplate(
    'What is a good name for a company that makes {product}?'
  )
  const chainA = new LLMChain({ llm: model, prompt })

  // The result is an object with a `text` property.
  const resA = await chainA.call(
    { product: 'colorful hockey sticks' },
    { callbacks: [langfuseHandler] }
  )
  console.log({ resA })
  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  await delay(4000)
}
