/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {onBFCacheRestore} from './lib/bfcache.js';
import {bindReporter} from './lib/bindReporter.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {getInteractionCount, initInteractionCountPolyfill} from './lib/polyfills/interactionCountPolyfill.js';
import {whenActivated} from './lib/whenActivated.js';
import {INPMetric, ReportCallback, ReportOpts} from './types.js';

interface Interaction {
  id: number;
  latency: number;
  entries: PerformanceEventTiming[];
}

// Used to store the interaction count after a bfcache restore, since p98
// interaction latencies should only consider the current navigation.
let prevInteractionCount = 0;

/**
 * Returns the interaction count since the last bfcache restore (or for the
 * full page lifecycle if there were no bfcache restores).
 */
const getInteractionCountForNavigation = () => {
  return getInteractionCount() - prevInteractionCount;
}

// To prevent unnecessary memory usage on pages with lots of interactions,
// store at most 10 of the longest interactions to consider as INP candidates.
const MAX_INTERACTIONS_TO_CONSIDER = 10;

// A list of longest interactions on the page (by latency) sorted so the
// longest one is first. The list is as most MAX_INTERACTIONS_TO_CONSIDER long.
let longestInteractionList: Interaction[] = [];

// A mapping of longest interactions by their interaction ID.
// This is used for faster lookup.
const longestInteractionMap: {[interactionId: string]: Interaction} = {};

/**
 * Takes a performance entry and adds it to the list of worst interactions
 * if its duration is long enough to make it among the worst. If the
 * entry is part of an existing interaction, it is merged and the latency
 * and entries list is updated as needed.
 */
const processEntry = (entry: PerformanceEventTiming) => {
  // The least-long of the 10 longest interactions.
  const minLongestInteraction =
      longestInteractionList[longestInteractionList.length - 1]

  const existingInteraction = longestInteractionMap[entry.interactionId!];

  // Only process the entry if it's possibly one of the ten longest,
  // or if it's part of an existing interaction.
  if (existingInteraction ||
      longestInteractionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
      entry.duration > minLongestInteraction.latency) {
    // If the interaction already exists, update it. Otherwise create one.
    if (existingInteraction) {
      existingInteraction.entries.push(entry);
      existingInteraction.latency =
          Math.max(existingInteraction.latency, entry.duration);
    } else {
      const interaction = {
        id: entry.interactionId!,
        latency: entry.duration,
        entries: [entry],
      }
      longestInteractionMap[interaction.id] = interaction;
      longestInteractionList.push(interaction);
    }

    // Sort the entries by latency (descending) and keep only the top ten.
    longestInteractionList.sort((a, b) => b.latency - a.latency);
    longestInteractionList.splice(MAX_INTERACTIONS_TO_CONSIDER).forEach((i) => {
      delete longestInteractionMap[i.id];
    });
  }
}

/**
 * Returns the estimated p98 longest interaction based on the stored
 * interaction candidates and the interaction count for the current page.
 */
const estimateP98LongestInteraction = () => {
	const candidateInteractionIndex = Math.min(longestInteractionList.length - 1,
      Math.floor(getInteractionCountForNavigation() / 50));

	return longestInteractionList[candidateInteractionIndex];
}

/**
 * Calculates the [INP](https://web.dev/responsiveness/) value for the current
 * page and calls the `callback` function once the value is ready, along with
 * the `event` performance entries reported for that interaction. The reported
 * value is a `DOMHighResTimeStamp`.
 *
 * A custom `durationThreshold` configuration option can optionally be passed to
 * control what `event-timing` entries are considered for INP reporting. The
 * default threshold is `40`, which means INP scores of less than 40 are
 * reported as 0. Note that this will not affect your 75th percentile INP value
 * unless that value is also less than 40 (well below the recommended
 * [good](https://web.dev/inp/#what-is-a-good-inp-score) threshold).
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called as soon as the value is initially
 * determined as well as any time the value changes throughout the page
 * lifespan.
 *
 * _**Important:** INP should be continually monitored for changes throughout
 * the entire lifespan of a page—including if the user returns to the page after
 * it's been hidden/backgrounded. However, since browsers often [will not fire
 * additional callbacks once the user has backgrounded a
 * page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden),
 * `callback` is always called when the page's visibility state changes to
 * hidden. As a result, the `callback` function might be called multiple times
 * during the same page load._
 */
export const onINP = (onReport: ReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};

  whenActivated(() => {
    // https://web.dev/inp/#what's-a-%22good%22-inp-value
    const thresholds = [200, 500];

    // TODO(philipwalton): remove once the polyfill is no longer needed.
    initInteractionCountPolyfill();

    let metric = initMetric('INP');
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (entries: INPMetric['entries']) => {
      entries.forEach((entry) => {
        if (entry.interactionId) {
          processEntry(entry);
        }

        // Entries of type `first-input` don't currently have an `interactionId`,
        // so to consider them in INP we have to first check that an existing
        // entry doesn't match the `duration` and `startTime`.
        // Note that this logic assumes that `event` entries are dispatched
        // before `first-input` entries. This is true in Chrome but it is not
        // true in Firefox; however, Firefox doesn't support interactionId, so
        // it's not an issue at the moment.
        // TODO(philipwalton): remove once crbug.com/1325826 is fixed.
        if (entry.entryType === 'first-input') {
          const noMatchingEntry = !longestInteractionList.some((interaction) => {
            return interaction.entries.some((prevEntry) => {
              return entry.duration === prevEntry.duration &&
                  entry.startTime === prevEntry.startTime;
            });
          });
          if (noMatchingEntry) {
            processEntry(entry);
          }
        }
      });

      const inp = estimateP98LongestInteraction();

      if (inp && inp.latency !== metric.value) {
        metric.value = inp.latency;
        metric.entries = inp.entries;
        report();
      }
    };

    const po = observe('event', handleEntries, {
      // Event Timing entries have their durations rounded to the nearest 8ms,
      // so a duration of 40ms would be any event that spans 2.5 or more frames
      // at 60Hz. This threshold is chosen to strike a balance between usefulness
      // and performance. Running this callback for any interaction that spans
      // just one or two frames is likely not worth the insight that could be
      // gained.
      durationThreshold: opts!.durationThreshold || 40,
    } as PerformanceObserverInit);

    report = bindReporter(onReport, metric, thresholds, opts!.reportAllChanges);

    if (po) {
      // Also observe entries of type `first-input`. This is useful in cases
      // where the first interaction is less than the `durationThreshold`.
      po.observe({type: 'first-input', buffered: true});

      onHidden(() => {
        handleEntries(po.takeRecords() as INPMetric['entries']);

        // If the interaction count shows that there were interactions but
        // none were captured by the PerformanceObserver, report a latency of 0.
        if (metric.value < 0 && getInteractionCountForNavigation() > 0) {
          metric.value = 0;
          metric.entries = [];
        }

        report(true);
      });

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore(() => {
        longestInteractionList = [];
        // Important, we want the count for the full page here,
        // not just for the current navigation.
        prevInteractionCount = getInteractionCount();

        metric = initMetric('INP');
        report = bindReporter(
            onReport, metric, thresholds, opts!.reportAllChanges);
      });
    }
  });
};
