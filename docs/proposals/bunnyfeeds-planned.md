# Bunnyfeeds: planned features

Planned for **after Bunnyfeeds' final switch** (onto #259 and #266). Not started.

## 1. A rolling feed memory (candidate headline for 1.1.4)

**Today.** She keeps one feed memory at a time (`fileFeedMemory` in
`src/renderer/stores/bunnyfeedsMemory.ts`): each reply call can hold a memory on the post, and when
its replies show, filing it removes her previous feed memory and adds the new one. Affection is
read from her last 20 memories (`affectionFor`), so comments move it by one memory's worth at most,
which keeps comments from farming affection.

**The problem.**
- Across slots, a later memory simply replaces an earlier one, so an insult is erased by a later
  compliment, and the reverse.
- In the same slot, every due memory is filed in the order of her posts in the feed, each replacing
  the last; only the last filed survives, picked by feed order rather than by what happened last or
  mattered most. Its affection effect goes with it.

**The idea.** No extra AI call. Each reply call is given her current feed memory, plus any held
ones not yet filed this slot, and writes **one updated memory** covering all of it, e.g. "He
insulted her cooking, then made up for it praising her art; she's still a bit wary." Filing stays
one feed memory at a time, but the one she keeps sums up the whole exchange, and its type (liked,
disliked, ...) sets the affection.

**Costs and care.**
- A memory line or two more per call.
- The AI judges the overall feeling: keep it to one sentence so it doesn't drift over many rounds.
- Changes the reply call's prompt, the held-memory shape and filing; old saves' held memories must
  still file.
- Behaviour players notice, so a changelog line, e.g. "She remembers the whole conversation on her
  posts, not just the last comment."

**Smaller fallback** if the above is too much: when several memories are due in the same slot,
keep the newest by comment time instead of feed order.
