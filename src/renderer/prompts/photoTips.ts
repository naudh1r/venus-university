/**
 * BunnyBot on photos: what the reader is told the first time a girl sends him one in a DM, and the
 * first time a post with a picture is on his Updates tab. Each said once, in the thread's own
 * voice, since nothing else in the game explains a covered picture, a frame that failed, or where
 * the pictures she sent him are kept.
 *
 * Each has one line with no name in it, which is how the delivery tells it has been said already:
 * BunnyBot's thread is in the save, so the save carries no flag of its own for either.
 */

/** The DM tip's line that marks it as said. */
export const DM_PHOTO_TIP_MARK = `the spicy ones come covered, so tap to take a peek... tap again to see it full size. if one ever fails to load, just hit reroll`

export function bunnybotDmPhotoTexts(firstName: string): readonly string[] {
  return [
    `ooh, ${firstName.toLowerCase()} just sent you a pic. photos on bunnyboard get drawn right on your own pc, so give them a sec to show up`,
    DM_PHOTO_TIP_MARK,
    `what they're willing to send depends on how close you two are, and her page keeps a gallery of everything she's sent you`,
    `and if you'd rather not get any, you can switch photos off in settings`
  ]
}

/** The feed tip's line that marks it as said. */
export const FEED_PHOTO_TIP_MARK = `pics on posts get drawn right on your own pc, so a post only shows up once its pic is ready. tap one to see it full size`

export function bunnybotFeedPhotoTexts(firstName: string): readonly string[] {
  return [
    `peep the updates tab... ${firstName.toLowerCase()} posted a pic`,
    FEED_PHOTO_TIP_MARK,
    `if one ever fails to load, you can hit reroll right there on the post. and photos can be switched off in settings if they're not your thing`
  ]
}
