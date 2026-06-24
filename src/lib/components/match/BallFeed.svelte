<script lang="ts">
  import type { BallEvent } from '$lib/models/match';
  
  interface Props {
    events?: BallEvent[];
  }
  
  let { events = [] }: Props = $props();
</script>

<div class="ball-feed">
  {#each events.slice(-20).reverse() as event (event)}
    <div class="ball-event" class:wicket={event.isWicket} class:four={event.result === 'four'} class:six={event.result === 'six'}>
      <span class="ball-number">{event.over}.{event.ball}</span>
      <span class="runs" class:dot={event.runs === 0} class:extra={event.result === 'wide' || event.result === 'noball'}>
        {#if event.isWicket}
          W
        {:else if event.result === 'wide'}
          {event.runs}wd
        {:else if event.result === 'noball'}
          {event.runs}nb
        {:else}
          {event.runs}
        {/if}
      </span>
      <span class="commentary">{event.commentary}</span>
    </div>
  {/each}
</div>

<style>
  .ball-feed {
    display: grid;
    gap: 0.45rem;
    max-height: 320px;
    overflow-y: auto;
    padding: 0.4rem;
    border-radius: 16px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
      var(--bg-surface);
    border: 1px solid rgba(148, 163, 184, 0.14);
  }

  .ball-event {
    display: grid;
    grid-template-columns: 56px 44px 1fr;
    gap: 0.65rem;
    align-items: center;
    padding: 0.7rem 0.75rem;
    border-radius: 12px;
    font-size: 0.84rem;
    animation: slideIn 180ms ease;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.08);
  }

  .ball-event:nth-child(even) {
    background: rgba(255, 255, 255, 0.02);
  }

  .ball-event.wicket {
    border-color: rgba(var(--accent-ruby-rgb), 0.24);
    background: rgba(var(--accent-ruby-rgb), 0.08);
    color: var(--danger);
    font-weight: 700;
  }

  .ball-event.four {
    border-color: rgba(var(--accent-gold-rgb), 0.22);
    background: rgba(var(--accent-gold-rgb), 0.08);
    color: var(--warning);
    font-weight: 700;
  }

  .ball-event.six {
    border-color: rgba(var(--accent-emerald-rgb), 0.22);
    background: rgba(var(--accent-emerald-rgb), 0.08);
    color: var(--success);
    font-weight: 700;
  }

  .runs.dot {
    opacity: 0.7;
    color: var(--text-muted);
  }

  .runs.extra {
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
  }

  .ball-number {
    color: var(--text-secondary);
    font-weight: 700;
    font-family: "Space Grotesk", sans-serif;
  }

  .runs {
    display: inline-grid;
    place-items: center;
    min-width: 2rem;
    font-weight: 800;
    border-radius: 999px;
    padding: 0.25rem 0.45rem;
    background: rgba(255, 255, 255, 0.05);
  }

  .commentary {
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
