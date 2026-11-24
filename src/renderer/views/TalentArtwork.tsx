import { TalentIcon } from './TalentIcon'

// Renderer-only artwork: skill IDs and saved ranks remain independent of filenames.
const images = import.meta.glob<string>('../assets/talents/**/*.png', {
  eager: true, import: 'default', query: '?url'
})

const skillFiles: Record<string, string> = {
  "body.training": "body/personal-best.png",
  "body.pe": "body/varsity-effort.png",
  "body.resist": "body/iron-constitution.png",
  "body.partner": "body/training-partner.png",
  "body.shift": "body/working-strength.png",
  "body.mild": "body/shake-it-off.png",
  "body.dancer": "body/dancer.png",
  "brain.focus": "brain/deep-focus.png",
  "brain.method": "brain/work-smarter.png",
  "brain.exam": "brain/test-strategy.png",
  "brain.notes": "brain/active-listening.png",
  "brain.cram": "brain/late-night-cram.png",
  "brain.polish": "brain/final-polish.png",
  "brain.eureka": "brain/eureka.png",
  "heart.confidence": "heart/quiet-confidence.png",
  "heart.class": "heart/class-act.png",
  "heart.pride": "heart/show-up.png",
  "heart.ease": "heart/social-ease.png",
  "heart.work": "heart/people-person.png",
  "heart.feet": "heart/finding-your-feet.png",
  "heart.silver-lining": "heart/silver-lining.png",
  "wages": "money/worth-your-while.png",
  "bargain": "money/bargain-hunter.png",
  "reserve": "money/rainy-day-fund.png",
  "reliable": "money/reliable-hand.png",
  "regular": "money/regular-customer.png",
  "interest": "money/nest-egg.png",
  "money.eye": "money/eye-for-value.png",
  "heart.warmth": "charm/warm-welcome.png",
  "heart.group": "charm/group-therapy.png",
  "heart.text": "charm/keep-in-touch.png",
  "heart.spark": "charm/lasting-impression.png",
  "heart.grace": "charm/a-little-grace.png",
  "heart.gift": "charm/thoughtful-gifts.png",
  "heart.anticipation": "charm/leave-them-wanting-more.png",
  "matching": "echoes/shared-wavelength.png",
  "competing": "echoes/embrace-the-difference.png",
  "kindling": "echoes/kindling.png",
  "neutral": "echoes/common-frequency.png",
  "spark": "echoes/shared-spark.png",
  "breath": "echoes/measured-breath.png",
  "echoes.borrowed": "echoes/borrowed-voice.png",
  "growth.personal": "shared/personal-growth.png"
}

export function TalentArtwork({skill}: {skill: string}) {
  const file = skillFiles[skill]
  const src = file ? images[`../assets/talents/${file}`] : undefined
  return <span className="vu-talent-art" aria-hidden="true">
    {src ? <img src={src} alt="" draggable={false}/> : <TalentIcon/>}
  </span>
}
