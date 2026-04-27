<script lang="ts">
  import type { BallEvent } from '$lib/models/match';
  
  interface Props {
    events?: BallEvent[];
  }
  
  let { events = [] }: Props = $props();
</script>

<div class="ball-feed">
  {#each events.slice(-20).reverse() as event (event.ballNumber)}
    <div class="ball-event" class:wicket={event.isWicket} class:four={event.result === 'four'} class:six={event.result === 'six'}>
      <span class="ball-number">{event.over}.{event.ball}</span>
      <span class="runs" class:dot={event.runs === 0}>
        {#if event.isWicket}
          W
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
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    height: 300px;
    overflow-y: auto;
    padding: 8px;
  }

  .ball-event {
    display: grid;
    grid-template-columns: 50px 40px 1fr;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    font-size: 13px;
    animation: slideIn 0.3s ease;
  }

  .ball-event:nth-child(even) {
    background: var(--bg-tertiary);
  }

  .ball-event.wicket {
    background: rgba(218, 54, 51, 0.15);
    border-left: 3px solid var(--danger);
  }

  .ball-event.four {
    border-left: 3px solid var(--accent-dwarf);
  }

  .ball-event.six {
    border-left: 3px solid var(--success);
  }

  .ball-number {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .runs {
    font-weight: 700;
    text-align: center;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .runs.dot {
    opacity: 0.5;
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
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>