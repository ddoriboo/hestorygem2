import Link from 'next/link'

interface BrandProps {
  size?: 'sm' | 'md' | 'lg'
  href?: string
  subtitle?: string
}

const sizeMap = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
}

/** OurStory 워드마크 — 세리프 디스플레이 + ember 강조점 */
export default function Brand({ size = 'md', href, subtitle }: BrandProps) {
  const mark = (
    <span className={`font-display font-bold tracking-tight text-ink ${sizeMap[size]}`}>
      Our<span className="text-ember">Story</span>
    </span>
  )

  return (
    <div className="flex flex-col items-center gap-1">
      {href ? <Link href={href} className="no-underline hover:opacity-100">{mark}</Link> : mark}
      {subtitle && (
        <span className="os-label-micro">{subtitle}</span>
      )}
    </div>
  )
}
