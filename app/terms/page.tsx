import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, H2, P, UL } from '@/app/components/LegalPage'

// Platform Terms & Conditions (spec 03-member-management.md §3.10, 01-onboarding.md §1.2). One
// document for studio owners, staff and members, accepted once per person. VERSION must match
// PlatformTerms.CurrentVersion in CalaStudio.Api: changing the wording means bumping both, which
// re-prompts everyone at their next sign-in.
// Draft prepared for review; the [bracketed] details must be filled in before it goes live.

const VERSION = 'v1'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms that apply to everyone who uses CalaStudio: studios, their teams and their members.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" version={VERSION} effective="[effective date]">
      <P>
        These terms apply when you use CalaStudio, whether you run a studio on it, work at one, or book classes
        with one. CalaStudio is operated by <strong>[Travel Engine legal entity name]</strong> (ABN [ABN])
        (&ldquo;CalaStudio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or ticking
        &ldquo;I accept the Terms &amp; Conditions&rdquo;, you agree to them.
      </P>

      <H2>1. What CalaStudio is</H2>
      <P>
        CalaStudio is software that yoga, fitness and wellness studios use to publish their timetable, take
        bookings, sell passes and memberships, and manage their members. Each studio is an independent business.
        When you book a class, buy a pass or attend a session, your agreement for that class or pass is with the
        studio, not with CalaStudio. The studio is responsible for its classes, prices, cancellation and refund
        rules, teachers, premises and its own Liability Waiver.
      </P>

      <H2>2. Your account</H2>
      <UL>
        <li>Give accurate details and keep them up to date.</li>
        <li>Keep your password private. Use at least 10 characters and don&rsquo;t reuse a password from another site.</li>
        <li>You&rsquo;re responsible for what happens under your account. Tell us straight away if you think someone else has used it.</li>
        <li>One CalaStudio account can be used with more than one studio. These terms apply to all of them.</li>
        <li>You must be 18 or over to create an account, or have a parent or guardian create and manage it for you.</li>
      </UL>

      <H2>3. If you book with a studio (members)</H2>
      <UL>
        <li>Payments for classes, passes and memberships are made to the studio through its own Stripe account. The studio is the seller.</li>
        <li>Each studio sets its own cancellation window, late-cancel and no-show rules, waitlist rules and refund policy. They&rsquo;re shown before you book. Refund requests go to the studio.</li>
        <li>Passes and memberships are used and expire as described when you buy them. Unused credits aren&rsquo;t refundable unless the studio says so or the law requires it.</li>
        <li>The studio may ask you to accept its own Liability Waiver. That waiver is between you and the studio.</li>
        <li>Studios can see the details you give them (name, contact details, booking and attendance history, and any health notes you choose to share) so they can run your classes safely.</li>
      </UL>

      <H2>4. If you run a studio (studio owners and staff)</H2>
      <UL>
        <li>You must have authority to bind the studio, and the studio is responsible for everyone it invites to its account and the roles it gives them.</li>
        <li>You connect your own Stripe account. Member payments go directly to it, and you&rsquo;re responsible for your prices, taxes (including GST), refunds, chargebacks and compliance with Stripe&rsquo;s terms.</li>
        <li>You&rsquo;re responsible for the content you publish (class descriptions, teacher pages, photos, your waiver) and for having the rights to it.</li>
        <li>You&rsquo;re responsible for how you use members&rsquo; personal information and must handle it lawfully, including under the Privacy Act 1988 (Cth). Only add or import people who have agreed to be your members, and only message them as the law allows.</li>
        <li>You must only register a member on someone&rsquo;s behalf when you have their permission. Members accept these terms and your waiver themselves.</li>
      </UL>

      <H2>5. Fees for studios</H2>
      <P>
        Studios choose a plan. <strong>Pay as you go</strong>: a fee of 5% of each member payment, calculated after
        Stripe&rsquo;s processing fee, plus GST. <strong>Monthly</strong>: A$45 a month, GST included.
        <strong> Annual</strong>: A$360 a year, GST included. Stripe&rsquo;s own processing fees are separate and
        charged by Stripe. We issue tax invoices for our fees. We may change prices with at least 30 days&rsquo;
        notice; the change applies from your next billing period. Monthly and Annual plans renew automatically
        until cancelled, and cancelling stops the next renewal. Fees already paid aren&rsquo;t refundable except
        where the law requires.
      </P>

      <H2>6. Acceptable use</H2>
      <P>Don&rsquo;t use CalaStudio to:</P>
      <UL>
        <li>break the law, or infringe anyone&rsquo;s rights;</li>
        <li>send spam, or collect people&rsquo;s details without permission;</li>
        <li>access accounts or data that aren&rsquo;t yours, probe or overload the service, or get around its security or limits;</li>
        <li>upload harmful code, or content that is misleading, abusive or unlawful.</li>
      </UL>
      <P>We may suspend or close accounts that break these terms, after notice where reasonable.</P>

      <H2>7. Availability and changes</H2>
      <P>
        We work to keep CalaStudio running and your data safe, but we can&rsquo;t promise it will always be
        available or error-free. We may improve and change features over time. If we change these terms in a way
        that matters, we&rsquo;ll ask you to accept the new version the next time you sign in.
      </P>

      <H2>8. Your data</H2>
      <P>
        Studios own the data they put into CalaStudio about their business and members. We handle personal
        information as described in our <Link href="/privacy" style={{ color: '#085041', fontWeight: 600 }}>Privacy Policy</Link>.
        A studio that closes its account can ask for an export of its data first.
      </P>

      <H2>9. Liability</H2>
      <P>
        Nothing in these terms excludes rights you have under the Australian Consumer Law that can&rsquo;t be
        excluded. Where the law allows, CalaStudio is provided &ldquo;as is&rdquo;; we aren&rsquo;t liable for
        indirect or consequential loss, or for a studio&rsquo;s classes, premises, conduct or refunds; and our
        total liability to a studio is limited to the fees it paid us in the 12 months before the claim. Where
        our liability for a consumer guarantee can be limited, it&rsquo;s limited to supplying the service again
        or paying for it to be supplied again.
      </P>

      <H2>10. Ending your account</H2>
      <P>
        You can stop using CalaStudio at any time. Members can ask a studio to remove them, or ask us to delete
        their CalaStudio account. Some records (for example payments and tax invoices) are kept for as long as
        the law requires.
      </P>

      <H2>11. General</H2>
      <P>
        These terms are governed by the laws of [Queensland], Australia. If part of them can&rsquo;t be enforced,
        the rest still applies.
      </P>

      <H2>12. Contact</H2>
      <P>Questions about these terms: <strong>[contact email]</strong>.</P>
    </LegalPage>
  )
}
