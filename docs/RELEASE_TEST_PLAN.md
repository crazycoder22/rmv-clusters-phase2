# RMV Clusters Phase 2 — Base Release Test Plan

A run-through checklist of every resident-facing feature on **Web** and **iOS**.
Tick each box as you verify. Legend: **W** = website, **M** = iOS mobile app.

> Scope note for this base version:
> - **Android is not shipped** (shared screens exist, but no Play build; push + Apple-Health steps are iOS-only). Test on **Web + iOS** only.
> - **Light/Dark theme** currently themes the **Home screen + Settings + bottom nav** only (other screens stay dark in light mode). Defaults to Dark.
> - **Push notifications** are **iOS-only** (APNs).

---

## 0. Pre-flight
- [ ] Web deployed (Vercel) on latest `main`; iOS on latest TestFlight build (48+).
- [ ] Test with **two accounts**: one normal resident, one **admin** (and ideally one **pending/unapproved**).
- [ ] Know one **bank-owned** flat, one **tenant** flat, one **owner** flat for occupancy checks.

---

## 1. Auth & onboarding
| # | Test | W | M |
|---|------|---|---|
| 1.1 | Sign in with Google → lands on dashboard | [ ] | [ ] |
| 1.2 | New/unapproved user sees **pending approval** screen, no resident features | [ ] | [ ] |
| 1.3 | Admin approves the pending user → user now has full access | [ ] | — |
| 1.4 | Sign out returns to login; re-login restores session | [ ] | [ ] |
| 1.5 | (M) Session persists after force-quit + relaunch | — | [ ] |

## 2. Home / Dashboard
| # | Test | W | M |
|---|------|---|---|
| 2.1 | Greeting + avatar render; "My upcoming" shows your RSVPs/registrations | [ ] | [ ] |
| 2.2 | **Latest news** section shows items from last 2 weeks; "View all" → News | [ ] | [ ] |
| 2.3 | Active polls / step hero / habits-today cards appear when relevant | [ ] | [ ] |
| 2.4 | (M) Explore grid links all work (News, Games, Directory, Groups, Community, Parking, Guidelines, Marketplace, Domestic Help, Emergency) | — | [ ] |
| 2.5 | (M) Emergency SOS button visible; **senior mode** moves it to top | — | [ ] |

## 3. Theme (Appearance)
| # | Test | W | M |
|---|------|---|---|
| 3.1 | (M) Settings → Appearance → **Light**: Home + bottom nav turn light | — | [ ] |
| 3.2 | (M) **Dark** restores dark; **System** follows phone setting | — | [ ] |
| 3.3 | (M) Choice persists after relaunch | — | [ ] |

## 4. News / Announcements
| # | Test | W | M |
|---|------|---|---|
| 4.1 | News list loads; open an article detail | [ ] | [ ] |
| 4.2 | Category filter works; only published items show | [ ] | [ ] |
| 4.3 | RSVP event: submit RSVP (plates/meal) → shows in "My upcoming" | [ ] | [ ] |
| 4.4 | Sports-registration event: register → confirmation | [ ] | [ ] |
| 4.5 | Paid event: payment flow / "mark paid" reflects correctly | [ ] | [ ] |
| 4.6 | Feedback (stars/emoji) submits | [ ] | [ ] |

## 5. Community feed
| # | Test | W | M |
|---|------|---|---|
| 5.1 | Feed loads; create a post | [ ] | [ ] |
| 5.2 | Like / unlike updates count | [ ] | [ ] |
| 5.3 | Comment on a post; comment appears | [ ] | [ ] |
| 5.4 | (M) New-comment push notification deep-links to the post | — | [ ] |

## 6. Messages (1:1)
| # | Test | W | M |
|---|------|---|---|
| 6.1 | Start a chat from Resident Directory / search | [ ] | [ ] |
| 6.2 | Send + receive a message; thread updates | [ ] | [ ] |
| 6.3 | Unread badge increments; clears on read | [ ] | [ ] |

## 7. Resident Directory
| # | Test | W | M |
|---|------|---|---|
| 7.1 | Search by name / flat returns results (not yourself) | [ ] | [ ] |
| 7.2 | Message button opens a thread | [ ] | [ ] |
| 7.3 | Phone number is **not** exposed (message-only) | — | [ ] |

## 8. SOS & Emergency
| # | Test | W | M |
|---|------|---|---|
| 8.1 | (M) Press SOS → confirm sheet → raises alert → alert screen | — | [ ] |
| 8.2 | (M) Warriors get the alert; respond/resolve flow works | — | [ ] |
| 8.3 | Active-alert banner shows on Home while live | — | [ ] |
| 8.4 | **Emergency contacts** list shows **Facility Manager 9945038871**, **no** old main-gate number; tap-to-call works | [ ] | [ ] |
| 8.5 | SOS Warriors list + SOS Guidelines pages load | [ ] | [ ] |

## 9. Marketplace
| # | Test | W | M |
|---|------|---|---|
| 9.1 | Browse list; search + category + type filters + sort | [ ] | [ ] |
| 9.2 | Open a listing detail (renders, no crash) | [ ] | [ ] |
| 9.3 | Post a new listing **with photo upload** (camera/library on M) | [ ] | [ ] |
| 9.4 | Wishlist add/remove; count updates | [ ] | [ ] |
| 9.5 | My-listings shows yours; **Mark as sold** / **Delete** as owner | [ ] | [ ] |
| 9.6 | Contact on WhatsApp opens chat | [ ] | [ ] |

## 10. Domestic Help
| # | Test | W | M |
|---|------|---|---|
| 10.1 | Browse; search + category filter + rating sort | [ ] | [ ] |
| 10.2 | Open a worker; tap-to-call | [ ] | [ ] |
| 10.3 | Add/edit your **review** (stars + comment); avg updates | [ ] | [ ] |
| 10.4 | Delete your review; owner/admin can delete listing | [ ] | [ ] |
| 10.5 | Add a new worker (multi-category) | [ ] | [ ] |

## 11. Food
| # | Test | W | M |
|---|------|---|---|
| 11.1 | Browse today's menus; open a menu | [ ] | [ ] |
| 11.2 | Place an order; appears in your orders | [ ] | [ ] |
| 11.3 | (Chef) Create/publish a menu → followers notified | [ ] | [ ] |
| 11.4 | Follow / unfollow a kitchen | [ ] | [ ] |

## 12. Parking
| # | Test | W | M |
|---|------|---|---|
| 12.1 | Browse slots; open a slot | [ ] | [ ] |
| 12.2 | Book a time range; no double-booking allowed | [ ] | [ ] |
| 12.3 | Register your slot; QR/pass generates | [ ] | — |
| 12.4 | Booking confirmation push (M) | — | [ ] |

## 13. Amenities
| # | Test | W | M |
|---|------|---|---|
| 13.1 | Browse amenities; pick a date; see availability | — | [ ] |
| 13.2 | Book a slot (capacity + per-resident cap enforced) | — | [ ] |
| 13.3 | My bookings list; cancel a booking | — | [ ] |
| 13.4 | (Admin) Manage amenities + approve booking requests | — | [ ] |

## 14. Habits
| # | Test | W | M |
|---|------|---|---|
| 14.1 | Create a habit (start/end/min-per-day + optional partner) | [ ] | [ ] |
| 14.2 | Mark today done; streak increments | [ ] | [ ] |
| 14.3 | Habit detail shows history/streak | [ ] | [ ] |
| 14.4 | (M) New-habit date fields don't overlap | — | [ ] |

## 15. Steps / Stepup
| # | Test | W | M |
|---|------|---|---|
| 15.1 | (M) Apple Health permission → steps sync to event leaderboard | — | [ ] |
| 15.2 | Manual step entry (web) records correctly | [ ] | — |
| 15.3 | Leaderboard ranks participants | [ ] | [ ] |
| 15.4 | /my-steps personal page shows daily activity | [ ] | [ ] |

## 16. Groups
| # | Test | W | M |
|---|------|---|---|
| 16.1 | Browse/join a group | [ ] | [ ] |
| 16.2 | Create a poll (**Play time / Closes** fields don't overlap on M) | [ ] | [ ] |
| 16.3 | Vote on a poll; results update; close poll | [ ] | [ ] |
| 16.4 | Manage members / delete group (admin/owner) | [ ] | [ ] |

## 17. Polls / Referendums / Initiatives
| # | Test | W | M |
|---|------|---|---|
| 17.1 | Polls: vote, see results | [ ] | [ ] |
| 17.2 | Referendums: vote (double-confirm), 3 states, close | [ ] | [ ] |
| 17.3 | Initiatives: list, detail, comment/reply/like, create | [ ] | [ ] |

## 18. Calendar
| # | Test | W | M |
|---|------|---|---|
| 18.1 | Calendar shows events/holidays/festivals | [ ] | [ ] |
| 18.2 | (Admin) Add/edit/delete a calendar entry | [ ] | [ ] |

## 19. Visitors & MyGate
| # | Test | W | M |
|---|------|---|---|
| 19.1 | Visitors / visit log for your flat loads | [ ] | [ ] |
| 19.2 | (Admin) Visit log + approval % per block | [ ] | [ ] |
| 19.3 | (Admin) MyGate complaints list + analytics charts | [ ] | [ ] |
| 19.4 | Gate pass `/pass/[code]` resolves | [ ] | — |

## 20. Vehicle stickers & vehicles
| # | Test | W | M |
|---|------|---|---|
| 20.1 | Request a vehicle sticker (car/bike) | [ ] | [ ] |
| 20.2 | My Vehicles shows registered vehicles | [ ] | [ ] |
| 20.3 | (Admin) Review sticker requests, mark issued | [ ] | [ ] |

## 21. Issues
| # | Test | W | M |
|---|------|---|---|
| 21.1 | Report a maintenance issue | [ ] | [ ] |
| 21.2 | (Admin) Triage / close an issue | [ ] | [ ] |

## 22. Medals & Awards
| # | Test | W | M |
|---|------|---|---|
| 22.1 | (Admin) Award a medal/coins to a resident | [ ] | [ ] |
| 22.2 | Recipient sees it in awards/profile | [ ] | — |

## 23. Games
| # | Test | W | M |
|---|------|---|---|
| 23.1 | Wordle / Sudoku / 2048 / Memory / Anagram playable; scores save | [ ] | [ ] |
| 23.2 | Tambola: host a session, draw numbers, players mark tickets | [ ] | [ ] |
| 23.3 | Quiz: host launches, players answer, leaderboard | [ ] | [ ] |
| 23.4 | Fantasy match flow | [ ] | [ ] |

## 24. Info & content
| # | Test | W | M |
|---|------|---|---|
| 24.1 | Community Guidelines / SOS Guidelines render | [ ] | [ ] |
| 24.2 | FAQ (topic-wise) | [ ] | [ ] |
| 24.3 | Gallery images load | [ ] | [ ] |
| 24.4 | Videos / playlists play | [ ] | [ ] |
| 24.5 | About / Contact / Privacy | [ ] | [ ] |

## 25. Occupancy (admin)
| # | Test | W | M |
|---|------|---|---|
| 25.1 | `/admin/occupancy` totals: 252 flats, owner vs tenant, bank, vacant | [ ] | [ ] |
| 25.2 | Per-block table sums to totals; owner+tenant bar correct | [ ] | [ ] |

## 26. Admin console (web-centric)
| # | Test | W | M |
|---|------|---|---|
| 26.1 | Residents: approve, edit (flat/phone/type), add new | [ ] | [ ] |
| 26.2 | Roles: assign/revoke (super-admin only) | [ ] | [ ] |
| 26.3 | Announcements: create/edit/publish (fires push on M) | [ ] | [ ] |
| 26.4 | Events: RSVPs, scanner, sports, steps, mark paid | [ ] | [ ] |
| 26.5 | Banner ads, Videos, Newsletters, Meetings, Surveys, Duties, Housekeeping, Documents, Review-docs, Checklist, Accounts/expenses | [ ] | — |

## 27. Notifications (iOS)
| # | Test | W | M |
|---|------|---|---|
| 27.1 | Allow notifications on first launch; token registers | — | [ ] |
| 27.2 | Announcement / comment / SOS / booking pushes arrive | — | [ ] |
| 27.3 | Tapping a push deep-links to the right screen | — | [ ] |

## 28. Cross-cutting / regression
- [ ] No screen shows a blank/error state on open (smoke-test every bottom-nav + More row).
- [ ] Back navigation works from every detail screen.
- [ ] No horizontal scroll / overlapping inputs on mobile forms.
- [ ] Slow/no-network: lists show loading then empty/error gracefully (no crash).
- [ ] Pull data with the **pending** account → restricted correctly.

---

### Known limitations to note in release notes
- Android build not yet available.
- Light/Dark theme is Home-only for now.
- Push notifications iOS-only.
- Step tracking requires Apple Health (iOS).
