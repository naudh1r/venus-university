/** The replies a post arrives with, written by the slot opening alongside the post itself. */

/**
 * The replies under a post, which the model writes because a canned line cannot answer what she
 * actually posted. Each is signed by a girl from `REPLIERS` or left unsigned for a stranger; how
 * many are kept is rolled afterwards, so this only has to supply enough of them.
 */
export function postCommentLines(hasRepliers: boolean): string[] {
  return [
    'Each post also carries "comments": what other students replied underneath it, in their own voices — up to five, and an empty array on the posts nobody answers, which is most of them. A post with a picture draws more than one without.',
    ...(hasRepliers
      ? [
          'A reply is either one of the girls REPLIERS names under that post or a stranger. For one of those girls, "from" is her key exactly as written there, and she types the way she would actually type — her own words, slang and emoji, not a generic commenter\'s — as a friend or as somebody who barely knows the poster, whichever REPLIERS says. Most replies are still strangers: one or two of the girls on a post at most, and none on many.'
        ]
      : []),
    'A stranger is one of the four thousand this campus holds: "from" is an empty string, she does not know the poster, and she is not the reader. No reply is the reader. No handles and no @s in "text" — just what each one said.',
    'They answer the post they are under. A reply to a picture is a reply to that picture; one under a picture with skin in it reads like a public feed at its least charming, which is strangers being obvious at somebody who did not ask.'
  ]
}

/** The field a post's replies need, spread into the slot-intro schema. */
export const POST_COMMENTS_SCHEMA_FIELD: Record<string, unknown> = {
  comments: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'text'],
      properties: { from: { type: 'string' }, text: { type: 'string' } }
    }
  }
}

/** **Required and answered empty**, never omitted, for the same reason as a post's picture. */
export const POST_COMMENTS_SCHEMA_REQUIRED = ['comments'] as const
