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

// Original 2020 Google LLC. Licensed under the Apache License,Version 2.0.
// Modifications Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

import { Metric, ReportCallback } from './base.js';
import { NavigationTimingPolyfillEntry } from './polyfills.js';

/**
 * A TTFB-specific version of the Metric object.
 */
export interface TTFBMetric extends Metric {
  name: 'TTFB';
  entries: PerformanceNavigationTiming[] | NavigationTimingPolyfillEntry[];
}

/**
 * An object containing potentially-helpful debugging information that
 * can be sent along with the TTFB value for the current page visit in order
 * to help identify issues happening to real-users in the field.
 */
export interface TTFBAttribution {
  /**
   * The total time from when the user initiates loading the page to when the
   * DNS lookup begins. This includes redirects, service worker startup, and
   * HTTP cache lookup times.
   */
  waitingTime: number;
  /**
   * The total time to resolve the DNS for the current request.
   */
  dnsTime: number;
  /**
   * The total time to create the connection to the requested domain.
   */
  connectionTime: number;

  // 2023-02-01: Amazon addition.
  /**
   * The time time from when the request was sent until the first byte of the
   * response was received. This includes network time as well as server
   * processing time.
   */
  requestTime: number;

  // 2023-02-01: Amazon addition.
  /**
   * The transfer size
  */
  transferSize: number;

  // 2023-02-01: Amazon addition.
  /**
     * The compression rate
  */
  compressRate?: number;

  // 2023-02-01: Amazon addition.
  /**
       * The cache status
  */
  cacheStatus?: string;

  // 2023-02-01: Amazon addition.
  //HTTP protocol used
  // nextHopProtocol?: string;

  // 2023-02-01: Amazon addition.
  //caller of this resource, image,link,script
  initiatorType?: string;

  // 2023-02-01: Amazon addition.
  // CDN identifier
  cdn?: string;

  // 2023-02-01: Amazon addition.
  //environment whether staging or prod..no value implies its prod
  env?: string;

  // name of the resource
  name?: string;

  // 2023-02-01: Amazon addition.
  // ServerTiming Headers
  serverTiming?: object;

  // 2023-02-01: Amazon addition.
  //metric Type whether resource, navigation, ttfb, lcp 
  metricType: string;

  /**
   * The `PerformanceNavigationTiming` entry used to determine TTFB (or the
   * polyfill entry in browsers that don't support Navigation Timing).
   */
  // navigationEntry?: PerformanceNavigationTiming | NavigationTimingPolyfillEntry;
}

/**
 * A TTFB-specific version of the Metric object with attribution.
 */
export interface TTFBMetricWithAttribution extends TTFBMetric {
  attribution: TTFBAttribution;
}

/**
 * A TTFB-specific version of the ReportCallback function.
 */
export interface TTFBReportCallback extends ReportCallback {
  (metric: TTFBMetric): void;
}

/**
 * A TTFB-specific version of the ReportCallback function with attribution.
 */
export interface TTFBReportCallbackWithAttribution extends TTFBReportCallback {
  (metric: TTFBMetricWithAttribution): void;
}
