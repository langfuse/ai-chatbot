'use client'

import { type Message } from 'ai'

import { Button } from '@/components/ui/button'
import { IconCheck, IconCopy } from '@/components/ui/icons'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
import {
  FaRegThumbsUp,
  FaRegThumbsDown,
  FaThumbsDown,
  FaThumbsUp
} from 'react-icons/fa'

import { LangfuseWeb } from 'langfuse'
import { useState } from 'react'
import clsx from 'clsx'
import { toast } from 'react-hot-toast'

interface ChatMessageActionsProps extends React.ComponentProps<'div'> {
  message: Message
  chatId?: string
}

const langfuse = new LangfuseWeb({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ?? ''
})

type Vote = 'up' | 'down'

export function ChatMessageActions({
  message,
  chatId,
  className,
  ...props
}: ChatMessageActionsProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })
  const [isVoting, setIsVoting] = useState(false)
  const [vote, setVote] = useState<Vote | null>(null)

  const onCopy = () => {
    if (isCopied) return
    copyToClipboard(message.content)
  }

  const handleFeedback = (vote: Vote) => {
    if (isVoting || !chatId) return
    setIsVoting(true)
    langfuse
      .score({
        traceId: `chat:${chatId}`,
        traceIdType: 'EXTERNAL',
        name: 'user-feedback',
        value: vote === 'up' ? 1 : -1
      })
      .then(res => {
        setIsVoting(false)
        setVote(vote)
      })
      .catch(err => {
        toast.error('Something went wrong')
        setIsVoting(false)
      })
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-end transition-opacity md:absolute md:-right-10',
        message.role === 'assistant' ? 'md:top-[-36px]' : 'md:-top-2',
        className
      )}
      {...props}
    >
      {message.role === 'assistant' && chatId ? (
        <Button
          variant="ghost"
          size="iconXs"
          className={clsx(
            vote === 'up'
              ? 'md:opacity-100'
              : 'group-hover:opacity-100 md:opacity-0'
          )}
          onClick={() => handleFeedback('up')}
          disabled={isVoting}
        >
          {vote === 'up' ? (
            <FaThumbsUp className="h-3 w-3" />
          ) : (
            <FaRegThumbsUp className="h-3 w-3" />
          )}
          <span className="sr-only">Upvote</span>
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="iconXs"
        onClick={onCopy}
        className="group-hover:opacity-100 md:opacity-0"
      >
        {isCopied ? <IconCheck /> : <IconCopy />}
        <span className="sr-only">Copy message</span>
      </Button>
      {message.role === 'assistant' && chatId ? (
        <Button
          variant="ghost"
          size="iconXs"
          className={clsx(
            vote === 'down'
              ? 'md:opacity-100'
              : 'group-hover:opacity-100 md:opacity-0'
          )}
          onClick={() => handleFeedback('down')}
          disabled={isVoting}
        >
          {vote === 'down' ? (
            <FaThumbsDown className="h-3 w-3" />
          ) : (
            <FaRegThumbsDown className="h-3 w-3" />
          )}
          <span className="sr-only">Downvote</span>
        </Button>
      ) : null}
    </div>
  )
}
