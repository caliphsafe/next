import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'NEXT · Your next chapter',description:'Your private daily operating system. Make room for what matters.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
