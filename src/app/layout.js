import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";

export const metadata = {
  title: "Dental Lead Generation & Cold Outreach CRM",
  description: "Automated CRM for discovering website-less US dentists and automating email pitches.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
