'use client'

import { type Message } from 'ai'

import { Button } from '@/components/ui/button'
import { IconCheck, IconCopy } from '@/components/ui/icons'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

import { LangfuseWeb } from 'langfuse'
import { useState } from 'react'

interface ChatMessageActionsProps extends React.ComponentProps<'div'> {
  message: Message
  chatId?: string
}

const langfuse = new LangfuseWeb({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ?? ''
})

export function ChatMessageActions({
  message,
  chatId,
  className,
  ...props
}: ChatMessageActionsProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })
  const [isVoting, setIsVoting] = useState(false)

  const onCopy = () => {
    if (isCopied) return
    copyToClipboard(message.content)
  }

  const handleFeedback = (score: number) => {
    if (isVoting || !chatId) return
    setIsVoting(true)
    langfuse
      .createScore({
        traceId: `chat:${chatId}`,
        traceIdType: 'EXTERNAL',
        name: 'user-feedback',
        value: score
      })
      .then(res => {
        setIsVoting(false)
      })
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-end transition-opacity group-hover:opacity-100 md:absolute md:-right-10 md:opacity-0',
        message.role === 'assistant' ? 'md:top-[-36px]' : 'md:-top-2',
        className
      )}
      {...props}
    >
      {message.role === 'assistant' && chatId ? (
        <Button
          variant="ghost"
          size="iconXs"
          onClick={() => handleFeedback(1)}
          disabled={isVoting}
        >
          <ThumbsUp className="h-3 w-3" />
          <span className="sr-only">Upvote</span>
        </Button>
      ) : null}
      <Button variant="ghost" size="iconXs" onClick={onCopy}>
        {isCopied ? <IconCheck /> : <IconCopy />}
        <span className="sr-only">Copy message</span>
      </Button>
      {message.role === 'assistant' && chatId ? (
        <Button
          variant="ghost"
          size="iconXs"
          onClick={() => handleFeedback(0)}
          disabled={isVoting}
        >
          <ThumbsDown className="h-3 w-3" />
          <span className="sr-only">Downvote</span>
        </Button>
      ) : null}
    </div>
  )
}
