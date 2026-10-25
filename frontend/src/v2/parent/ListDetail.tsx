import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { useMediaQuery } from '@mantine/hooks'

export function ListDetail({
  list,
  detail,
  listTitle,
  phone,
}: {
  list: ReactNode
  detail: ReactNode
  listTitle: ReactNode
  /** phone only: replaces list-then-detail with this strip plus the detail */
  phone?: ReactNode
}) {
  const router = useRouter()
  const small = useMediaQuery('(max-width: 767px)')
  const selectedItem = router.query.item

  if (small && phone) {
    return (
      <div className="p-detail-only">
        {phone}
        <div className="p-detail-panel">{detail}</div>
      </div>
    )
  }

  if (small && selectedItem) {
    return (
      <div className="p-detail-only">
        <Link href={router.pathname} className="p-back-link">
          ← {listTitle}
        </Link>
        <div className="p-detail-panel">{detail}</div>
      </div>
    )
  }

  if (small) {
    return <div className="p-list-only">{list}</div>
  }

  return (
    <div className="p-list-detail">
      <div className="p-list-column">{list}</div>
      <div className="p-detail-column p-grid">{detail}</div>
    </div>
  )
}
