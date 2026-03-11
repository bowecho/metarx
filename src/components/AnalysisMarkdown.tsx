import ReactMarkdown from 'react-markdown'

type AnalysisMarkdownProps = {
  markdown: string
}

export default function AnalysisMarkdown({ markdown }: AnalysisMarkdownProps) {
  return <ReactMarkdown>{markdown}</ReactMarkdown>
}
