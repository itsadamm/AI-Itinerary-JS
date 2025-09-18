import './globals.css'
import { DM_Sans, Playfair_Display } from 'next/font/google'

const sans = DM_Sans({ subsets: ['latin'], weight: ['400','500','700'] })
const serif = Playfair_Display({ subsets: ['latin'], weight: ['400','700'] })

export const metadata = {
  title: 'AI Itinerary',
  description: 'Editor-first AI travel planning',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.className}`}>
        {children}
      </body>
    </html>
  )
}
