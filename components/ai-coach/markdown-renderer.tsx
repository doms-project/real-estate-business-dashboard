"use client"

import { useMemo } from "react"

interface MarkdownRendererProps {
  content: string
}

/**
 * Simple markdown renderer without external dependencies
 * Handles basic markdown formatting: headers, lists, bold, code
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    let html = content

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-2 mb-1">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-3 mb-2">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')

    // Code blocks
    html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')

    // Numbered lists
    html = html.replace(/^\d+\.\s+(.*)$/gim, '<li class="ml-2">$1</li>')
    html = html.replace(/(<li class="ml-2">.*<\/li>\n?)+/g, (match) => {
      return `<ol class="list-decimal list-inside mb-2 space-y-1">${match}</ol>`
    })

    // Bullet lists
    html = html.replace(/^[-*]\s+(.*)$/gim, '<li class="ml-2">$1</li>')
    html = html.replace(/(<li class="ml-2">.*<\/li>\n?)+/g, (match) => {
      if (!match.includes('<ol')) {
        return `<ul class="list-disc list-inside mb-2 space-y-1">${match}</ul>`
      }
      return match
    })

    // Paragraphs (split by double newlines)
    const paragraphs = html.split(/\n\n+/)
    html = paragraphs
      .map((para) => {
        para = para.trim()
        if (!para) return ''
        // Don't wrap if it's already a list or header
        if (para.startsWith('<') && (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol'))) {
          return para
        }
        return `<p class="mb-2">${para}</p>`
      })
      .join('')

    // Line breaks
    html = html.replace(/\n/g, '<br />')

    return html
  }, [content])

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  )
}

