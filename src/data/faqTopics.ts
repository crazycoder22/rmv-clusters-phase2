// Topic-based FAQ structure. Each topic gets its own page at /faq/[slug];
// the /faq landing page lists all topics as cards.
//
// To add a new topic, append a new FAQTopic to FAQ_TOPICS below — no UI
// changes needed. Each Q&A item supports a paragraph answer plus optional
// bullets and a highlighted note (for warnings / important callouts).

export interface FAQItem {
  id: string;
  question: string;
  /** Main paragraph. Use simple **bold** markers for emphasis (rendered). */
  answer: string;
  /** Optional bullet list shown below the paragraph. */
  bullets?: string[];
  /** Optional highlighted note (renders in a yellow/amber box). */
  note?: string;
}

export interface FAQTopic {
  /** URL slug — used in /faq/[slug]. Lowercase-kebab. */
  slug: string;
  title: string;
  /** Short description shown on the topic card. */
  description: string;
  /** Single emoji shown on the card. */
  emoji: string;
  /** Optional intro paragraph shown above the questions. */
  intro?: string;
  /** Optional URL to a downloadable PDF version (e.g. /docs/foo.pdf). */
  pdfUrl?: string;
  /** Date the topic was published, ISO date or display string. */
  publishedAt?: string;
  /** Mark as "New" / featured on the landing page. */
  isNew?: boolean;
  items: FAQItem[];
}

// ── MyGate Full Adoption Day FAQ ─────────────────────────────────────────
// Sourced from MyGate_Adoption_FAQ.pdf (21 April 2026 launch).
const MYGATE_ADOPTION: FAQTopic = {
  slug: "mygate-adoption-day",
  title: "MyGate Full Adoption Day",
  description:
    "Common questions and clarifications for the 21st April rollout — visitor approvals, deliveries, work tickets, and more.",
  emoji: "🛡️",
  intro:
    "As we move towards full adoption from 21st April, here are some common questions and clarifications to help everyone transition smoothly.",
  pdfUrl: "/docs/mygate-adoption-faq.pdf",
  publishedAt: "21 April 2026",
  isNew: true,
  items: [
    {
      id: "mygate-1",
      question:
        "Is it mandatory to approve all visitors (guests, delivery, etc.) at any time of the day?",
      answer:
        "**Yes, it is mandatory.** We want to ensure that no person who is not intended or authorized by a resident enters the premises. This is a key step in keeping RMV safe for everyone.",
    },
    {
      id: "mygate-2",
      question:
        "Do we need to approve cabs/autos? Can I just approve when the driver hands the phone to security?",
      answer:
        "**Yes**, approval is mandatory for cabs, autos, or any other vehicle. You can use the **pre-approve** option in MyGate as soon as you book the cab.\n\nWe request you to approve directly in MyGate instead of over a phone call. This helps us track approvals properly and ensures we have the right data to verify that security processes are being followed across the community.",
    },
    {
      id: "mygate-3",
      question: "What if I forget to approve — is it considered approved by default?",
      answer:
        "**No.** Until now, no response was considered as approved. From 21st onwards, unless you explicitly approve, it will be treated as **rejected by default**. This ensures consistent and fair enforcement for everyone.",
    },
    {
      id: "mygate-4",
      question: "What about senior citizens who are not accustomed to technology?",
      answer:
        "We understand this situation. In such cases, security will call them to confirm if a visitor is expected, and only after confirmation will entry be allowed. This will be handled as an exception, while ensuring safety is not compromised.",
    },
    {
      id: "mygate-5",
      question: "Will security call if we don't approve?",
      answer:
        "**No.** The responsibility of approving visitors lies with the resident. If not approved, the visitor will be held at the entrance until approval is given.\n\nOnly in special cases (like senior citizens) will security make a call. This helps us build a system where responsibility is shared across the community.",
    },
    {
      id: "mygate-6",
      question: "Do we need to approve Amazon/Flipkart deliveries?",
      answer:
        "**Yes.** All deliveries where the person enters the premises must be approved. Otherwise, the delivery may be sent back. This ensures only intended deliveries reach your doorstep.",
    },
    {
      id: "mygate-7",
      question: "Do we need approval for courier/parcel drop at security?",
      answer:
        "If the person is not entering the premises, approval is not required. For parcel drop at security, please inform security in advance — **the resident's consent is a must before security receives any parcel.** Kindly collect your parcel within 1–2 days, as we don't have space to store parcels. **At present, the security room cannot be relied upon as a safe place to keep parcels for an extended period.**\n\nA separate SOP will be rolled out in this regard.",
      note: "If a parcel is lost at the entrance, the committee will not be responsible. We've seen cases where parcels were left uncollected for days — timely pickup helps keep things manageable for everyone.",
    },
    {
      id: "mygate-8",
      question: "Do we need to approve post from the postal service?",
      answer: "**Yes.** Same process as e-commerce deliveries.",
    },
    {
      id: "mygate-9",
      question: "What if I am in a meeting and there is a delivery?",
      answer:
        "We request you to use the **pre-approval** option. We understand this may cause slight inconvenience, but it ensures that no one reaches your door without your consent.",
    },
    {
      id: "mygate-10",
      question:
        "Sometimes delivery persons go to the wrong house — how are we solving this?",
      answer:
        "In the first phase, we are focusing on visitor approval. We are aware of this issue and will address it in upcoming iterations as we improve the overall system.",
    },
    {
      id: "mygate-11",
      question:
        "I need to get my fan fixed / pipe repaired. Can I call Murthy/Gopal directly?",
      answer:
        "**No.** Please raise a ticket in MyGate. Even if you call them directly, they will guide you to raise a request. This helps us:",
      bullets: [
        "Track all work requests",
        "Prioritize tasks better",
        "Allocate staff effort effectively across RMV",
      ],
    },
    {
      id: "mygate-12",
      question:
        "I want to check CCTV footage (e.g., for a car scratch). Do I need to raise a ticket?",
      answer:
        "**Yes.** CCTV review is time-consuming and needs prioritization. Please raise a ticket in MyGate so it can be handled systematically along with other requests.",
    },
    {
      id: "mygate-13",
      question:
        "I see something needs fixing in the children's park or notice a safety issue. Should I raise it in MyGate?",
      answer:
        "**Yes, absolutely.** Any maintenance or safety concern should be raised in MyGate. This helps us capture issues in one place, track them to closure, and ensure RMV remains safe and well-maintained for everyone.",
    },
  ],
};

// ── Existing general community FAQs (migrated from faq.json) ─────────────
const GENERAL_COMMUNITY: FAQTopic = {
  slug: "general",
  title: "General Community",
  description: "Day-to-day questions about living at RMV — maintenance, move-in, move-out, and more.",
  emoji: "🏠",
  items: [
    {
      id: "general-1",
      question: "How do I report a maintenance issue?",
      answer:
        "Report maintenance issues via MyGate. For urgent issues, use the community WhatsApp group or reach out to the Facility Manager directly.",
    },
    {
      id: "general-2",
      question: "What are the move-in/move-out procedures?",
      answer:
        "Moving in or out requires prior notice to the management office (at least 48 hours). Moving activities are allowed only between 8:00 AM and 6:00 PM. A no-objection certificate (NOC) from the association is required for move-out.",
    },
  ],
};

// ── Topic registry ───────────────────────────────────────────────────────
// Order here = order on the landing page. Featured/new topics first.
export const FAQ_TOPICS: FAQTopic[] = [MYGATE_ADOPTION, GENERAL_COMMUNITY];

export function getTopicBySlug(slug: string): FAQTopic | undefined {
  return FAQ_TOPICS.find((t) => t.slug === slug);
}
