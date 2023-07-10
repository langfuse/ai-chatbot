'use client'

import { type Message } from 'ai'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import { Textarea } from './ui/textarea'

interface ChatMessageActionsProps extends React.ComponentProps<'div'> {
  message: Message
  chatId?: string
}

const langfuse = new LangfuseWeb({
  publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ?? ''
})

type Feedback = 'positive' | 'negative'

export function ChatMessageActions({
  message,
  chatId,
  className,
  ...props
}: ChatMessageActionsProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })
  const [currentFeedback, setCurrentFeedback] = useState<
    Feedback | 'submitting' | null
  >(null)

  const [modalState, setModalState] = useState<{
    messageId: string
    feedback: Feedback
    comment: string
  } | null>(null)

  const onCopy = () => {
    if (isCopied) return
    copyToClipboard(message.content)
  }

  const handleSubmit = () => {
    if (currentFeedback === 'submitting' || !chatId || !modalState) return
    const { comment, feedback, messageId } = modalState

    setCurrentFeedback('submitting')

    langfuse
      .score({
        traceId: `chat:${chatId}`,
        traceIdType: 'EXTERNAL',
        name: 'user-feedback',
        value: feedback === 'positive' ? 1 : -1,
        comment: comment !== '' ? comment : undefined
      })
      .then(res => {
        setCurrentFeedback(feedback)
      })
      .catch(err => {
        toast.error('Something went wrong')
        setCurrentFeedback(null)
      })

    // close modal
    setModalState(null)
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
            currentFeedback === 'positive'
              ? 'md:opacity-100'
              : 'group-hover:opacity-100 md:opacity-0'
          )}
          onClick={() =>
            setModalState({
              messageId: message.id,
              feedback: 'positive',
              comment: ''
            })
          }
          disabled={currentFeedback === 'submitting'}
        >
          {currentFeedback === 'positive' ? (
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
            currentFeedback === 'negative'
              ? 'md:opacity-100'
              : 'group-hover:opacity-100 md:opacity-0'
          )}
          onClick={() =>
            setModalState({
              messageId: message.id,
              feedback: 'negative',
              comment: ''
            })
          }
          disabled={currentFeedback === 'submitting'}
        >
          {currentFeedback === 'negative' ? (
            <FaThumbsDown className="h-3 w-3" />
          ) : (
            <FaRegThumbsDown className="h-3 w-3" />
          )}
          <span className="sr-only">Downvote</span>
        </Button>
      ) : null}
      <Dialog open={!!modalState} onOpenChange={() => handleSubmit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Do you want to add a comment?</DialogTitle>
            <DialogDescription>
              <Textarea
                className="mt-4 mb-2"
                value={modalState?.comment ?? ''}
                onChange={e => {
                  setModalState({ ...modalState!, comment: e.target.value })
                }}
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="submit"
              onClick={() => handleSubmit()}
              variant="secondary"
            >
              No, thank you
            </Button>
            <Button type="submit" onClick={() => handleSubmit()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
