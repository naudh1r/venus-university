/**
 * BunnyBot on photos: what the reader is told the first time a girl sends him one. Said once, and
 * in the thread's own voice, since nothing else in the game explains a covered picture, a frame
 * that failed, or where the pictures she sent him are kept.
 */
export function bunnybotPhotoTexts(firstName: string): readonly string[] {
  return [
    `ooh, ${firstName.toLowerCase()} just sent you a pic. photos on bunnyboard get drawn right on your own pc, so give them a sec to show up`,
    `the spicy ones come covered, so tap to take a peek... tap again to see it full size. if one ever fails to load, just hit reroll`,
    `what they're willing to send depends on how close you two are. posts on the updates tab can have pics too, and her page keeps a gallery of everything she's sent you`,
    `and if you'd rather not get any, you can switch photos off in settings`
  ]
}
