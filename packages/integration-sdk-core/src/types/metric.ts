export interface Metric {
  metricName: string;
  value: number;

  /*
   * The unit to log the metric as
   */
  unit: 'Milliseconds';

  /**
   * Dimensions to add to a metric
   */
  dimensions?: Record<string, string>;

  /**
   * The time that the metric was collected.
   */
  timestamp: number;
}
