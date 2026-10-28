import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, H2, P, UL } from '@/app/components/LegalPage'

// Privacy Policy for the CalaStudio platform (Privacy Act 1988 (Cth), Australian Privacy Principles).
// Draft prepared for review; the [bracketed] details must be filled in before it goes live. Keep
// the list of service providers in sync with where the platform actually runs.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How CalaStudio collects, uses, stores and shares personal information.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effective="[effective date]">
      <P>
        This policy explains how <strong>[Travel Engine legal entity name]</strong> (ABN [ABN]), which operates
        CalaStudio, handles personal information. We follow the Australian Privacy Principles in the Privacy Act
        1988 (Cth).
      </P>

      <H2>Studios and CalaStudio</H2>
      <P>
        Studios use CalaStudio to manage their members. For information a studio collects about its members
        (bookings, attendance, passes, notes), the studio decides what is collected and how it&rsquo;s used, and
        CalaStudio stores and processes it on the studio&rsquo;s behalf. Each studio is responsible for its own
        privacy practices; contact the studio directly about how it uses your information. This policy covers
        what CalaStudio itself does.
      </P>

      <H2>What we collect</H2>
      <UL>
        <li><strong>Account details:</strong> your name, email, phone, and the password you set (stored securely by our sign-in provider; we never see it).</li>
        <li><strong>Profile details you or your studio add:</strong> such as date of birth, address, emergency contact, and health notes you choose to share with a studio.</li>
        <li><strong>Activity:</strong> bookings, check-ins, waitlist places, passes and memberships, and a record of changes made to them and by whom.</li>
        <li><strong>Payments:</strong> amounts, dates and status. Card details are entered into Stripe&rsquo;s secure form and never reach our servers.</li>
        <li><strong>Agreements:</strong> when you accepted these Terms and a studio&rsquo;s Liability Waiver, and which version.</li>
        <li><strong>Technical information:</strong> sign-in times, device and browser details and logs, used to run and secure the service.</li>
      </UL>

      <H2>How we use it</H2>
      <UL>
        <li>to run your account and the studios you belong to: bookings, payments, passes, check-ins and reminders;</li>
        <li>to send service emails such as booking confirmations, receipts and password resets;</li>
        <li>to bill studios for their CalaStudio plan;</li>
        <li>to keep the service secure, prevent fraud and fix problems;</li>
        <li>to meet our legal obligations, for example tax records.</li>
      </UL>
      <P>We don&rsquo;t sell personal information, and we don&rsquo;t use members&rsquo; information to market to them ourselves.</P>

      <H2>Who we share it with</H2>
      <UL>
        <li>the studio(s) you book with or work at;</li>
        <li>service providers that host and run CalaStudio for us, under contract: Supabase (database and sign-in), DigitalOcean (application servers), Vercel (website hosting), Stripe (payments), and Resend (email);</li>
        <li>authorities, where the law requires.</li>
      </UL>

      <H2>Where it&rsquo;s stored</H2>
      <P>
        Our database and application servers are in <strong>Singapore</strong>. Some providers, such as Vercel,
        Stripe and Resend, may also process information in other countries, including the United States. We
        choose providers with strong security and contractual privacy protections.
      </P>

      <H2>Keeping it safe</H2>
      <P>
        Information is encrypted in transit, access is limited by role (for example, some teachers can&rsquo;t see
        members&rsquo; contact or payment details), and changes are recorded in an activity log. If a data breach
        is likely to cause serious harm, we&rsquo;ll notify affected people and the OAIC as the law requires.
      </P>

      <H2>How long we keep it</H2>
      <P>
        We keep information while your account or the studio&rsquo;s account is active, and afterwards only as
        long as needed for the purposes above or as the law requires (for example, financial records for 5 years).
      </P>

      <H2>Your choices and rights</H2>
      <UL>
        <li>You can see and update most of your details in your account.</li>
        <li>You can ask us for a copy of the personal information we hold about you, or to correct it.</li>
        <li>You can ask us to delete your CalaStudio account. Some records may be kept where the law requires.</li>
      </UL>

      <H2>Questions and complaints</H2>
      <P>
        Contact us at <strong>[privacy contact email]</strong>. We&rsquo;ll respond within 30 days. If
        you&rsquo;re not satisfied with our response, you can complain to the Office of the Australian Information
        Commissioner at oaic.gov.au.
      </P>

      <P>
        See also our <Link href="/terms" style={{ color: '#085041', fontWeight: 600 }}>Terms &amp; Conditions</Link>.
      </P>
    </LegalPage>
  )
}
