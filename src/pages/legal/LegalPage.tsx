import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LEGAL_CONTENT, type LegalDoc } from './legalContent'
import styles from './LegalPage.module.css'

type Props = { doc: LegalDoc }

export default function LegalPage({ doc }: Props) {
  const navigate = useNavigate()
  const content = LEGAL_CONTENT[doc]
  return (
    <div className={styles.page}>
      <article className={styles.inner}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          돌아가기
        </button>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.updated}>{content.updated}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className={styles.paragraph}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  )
}
