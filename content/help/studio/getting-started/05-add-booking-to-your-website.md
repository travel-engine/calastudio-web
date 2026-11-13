---
title: Add booking to your own website
description: Put your schedule and booking on your WordPress, Squarespace, Wix or other website with one line of code
order: 5
---

# Add booking to your own website

Already have a website? You can put your CalaStudio schedule on it. Members browse your classes, sign in, pay and book without leaving your site, and it all goes into CalaStudio just like a booking from your booking page.

Your booking page at `{your-studio}.calastudio.app` keeps working as well. Use both: the widget on your website, and the booking page for your Instagram bio, QR codes and emails.

## Choose a style

**Schedule on the page.** Your class list sits inside a page of your website, for example a "Timetable" or "Book a class" page. It sizes itself to fit, so there's no box to scroll inside.

```html
<script src="https://calastudio.app/widget.js" data-studio="your-studio" async></script>
```

**Book button.** A **Book a class** button floats in the corner of every page. Tapping it opens your schedule full-screen. This is a good choice if most of your members visit on their phones.

```html
<script src="https://calastudio.app/widget.js" data-studio="your-studio" data-mode="popup" async></script>
```

In both, replace `your-studio` with the first part of your web address. For example, if your booking page is `yoga-with-ravi.calastudio.app`, use `data-studio="yoga-with-ravi"`. See **Getting started → Your web address**.

## Paste it into your website

Paste the code once, where you want the schedule to appear. For the **Book button** style, put it somewhere that's on every page, such as your site's footer or its site-wide code settings.

- **WordPress:** edit the page, add a **Custom HTML** block, and paste the code into it.
- **Squarespace:** edit the page, add a **Code** block, and paste the code. For the Book button on every page, use **Settings → Advanced → Code Injection → Footer** instead. Some Squarespace plans don't allow code. If yours doesn't, Squarespace will say so.
- **Wix:** for the Book button, go to **Settings → Custom Code**, add the code, and set it to load on **All pages** in the **Body – end**. For a schedule on the page, use **Add → Embed Code → Embed HTML** and paste the code. Wix shows embedded code in a fixed-size box, so make the box tall. Custom code needs a paid Wix plan.
- **Webflow:** drag a **Code Embed** element onto the page and paste the code. For the Book button, use **Site settings → Custom code → Footer code**.
- **Showit:** add an **Embed Code** element and paste the code.
- **Any other website:** paste the code into the page's HTML where you want the schedule to appear.

Then preview or publish the page and check your classes show up.

## Options

Add any of these to the code, just like `data-studio`:

| Option | What it does | Example |
| --- | --- | --- |
| `data-mode="popup"` | Book button instead of a schedule on the page | `data-mode="popup"` |
| `data-color` | Colour of the booking screens and the Book button | `data-color="#085041"` |
| `data-button` | Text on the floating Book button, or `false` for no floating button | `data-button="Book now"` |
| `data-target` | Put the schedule inside a particular part of your page (website builders' "ID" or "anchor" setting) | `data-target="#timetable"` |

**Use your own buttons.** With the Book button style, any button or link on your site can open your schedule. Add `data-calastudio-open` to it, like this: `<a href="#" data-calastudio-open>Book now</a>`. Combine it with `data-button="false"` if you'd rather not have the floating button as well.

## What members see

- Your schedule, filters and prices, in your booking page's style. Change the look in **Settings → Booking page**. See **Settings → Booking page settings**.
- Tapping **Book** opens the same booking steps as your booking page: sign in or create an account, choose a pass or pay, and confirm. It fills the screen while they book, then returns them to your page.
- Links such as **My account** open your CalaStudio booking page in a new tab, so your website stays open.

**Signing in:** members sign in once on your website, even if they've already signed in on your booking page. Browsers keep the two separate for privacy. Their account, passes and bookings are the same in both places.

## Track bookings in Google Analytics or Meta Pixel

Your website can tell when someone books. The widget sends these events to the page:

- `calastudio:booking_started`: they opened a class to book
- `calastudio:booking_completed`: the booking is confirmed
- `calastudio:waitlist_joined`: they joined a waitlist

For example, to count bookings in Google Analytics, add this below the widget code:

```html
<script>
  window.addEventListener('calastudio:booking_completed', function (e) {
    gtag('event', 'class_booked', { class_name: e.detail.session_name })
  })
</script>
```

Your web developer can set these up for you.

## Troubleshooting

- **Nothing shows up.** Check `data-studio` matches your web address exactly, in lowercase with hyphens. Some website builders only run code on the published site, not in their editor preview.
- **The schedule is cut off.** Your website builder has put the code in a fixed-size box (common on Wix). Make the box taller, or switch to the Book button style.
- **Apple Pay or Google Pay doesn't appear.** Some website builders block these inside embedded code. Members can still pay by card.
