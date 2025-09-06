/**
 * @fileoverview Production Quality Monitor for Story 5.1
 * 
 * Implements continuous monitoring and alerting for quality metrics
 * in production environment. Tracks real-time performance, accuracy,
 * security, and privacy compliance metrics.
 * 
 * This monitor ensures ongoing quality validation beyond deployment.
 */

import { AlertThreshold, MONITORING_ALERT_THRESHOLDS } from './QualityGateConfig';

// Metrics collection interfaces
interface MetricValue {
  value: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface MetricSeries {
  metric: string;
  values: MetricValue[];
  timeWindow: string;
}

interface QualityMetrics {
  strugglePredictionAccuracy: number;
  behavioralSignalLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  canvasIntegrationHealth: {
    messageDeliveryRate: number;
    errorRate: number;
    responseTime: number;
  };
  privacyComplianceRate: {
    consentValidationRate: number;
    dataRetentionCompliance: number;
    anonymizationSuccessRate: number;
  };
  userSatisfactionScore: number;
  systemHealthMetrics: {
    durableObjectMemoryUsage: number;
    cpuUtilization: number;
    errorRate: number;
    activeUsers: number;
  };
}

interface Alert {
  id: string;
  metric: string;
  severity: 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface AlertRule {
  metric: string;
  condition: 'above' | 'below';
  warningThreshold: number;
  criticalThreshold: number;
  duration: string;
  enabled: boolean;
}

/**
 * Production Quality Monitor
 * Continuously monitors quality metrics and triggers alerts
 */
export class ProductionQualityMonitor {
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private dataRetentionPeriod: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private monitoringInterval: number = 60 * 1000; // 1 minute
  private isRunning: boolean = false;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.alertManager = new AlertManager();
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.warn('Quality monitoring is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting production quality monitoring for Story 5.1...');

    // Initialize alert rules
    await this.initializeAlertRules();

    // Start monitoring loop
    this.monitoringLoop();
  }

  /**
   * Stop continuous monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isRunning = false;
    console.log('⏹️ Stopping production quality monitoring');
  }

  /**
   * Main monitoring loop
   */
  private async monitoringLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.collectAndEvaluateMetrics();
        await this.sleep(this.monitoringInterval);
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        await this.sleep(this.monitoringInterval);
      }
    }
  }

  /**
   * Collect metrics and evaluate against thresholds
   */
  private async collectAndEvaluateMetrics(): Promise<void> {
    console.log('📊 Collecting quality metrics...');

    // Collect current metrics
    const metrics = await this.collectQualityMetrics();
    
    // Store metrics
    await this.metricsCollector.recordMetrics(metrics);

    // Evaluate alert conditions
    await this.evaluateAlertConditions(metrics);

    // Log summary
    this.logMetricsSummary(metrics);
  }

  /**
   * Collect comprehensive quality metrics
   */
  private async collectQualityMetrics(): Promise<QualityMetrics> {
    const [
      strugglerAccuracy,
      signalLatency,
      canvasHealth,
      privacyCompliance,
      userSatisfaction,
      systemHealth
    ] = await Promise.all([
      this.measureStrugglePredictionAccuracy(),
      this.measureBehavioralSignalLatency(),
      this.measureCanvasIntegrationHealth(),
      this.measurePrivacyCompliance(),
      this.measureUserSatisfaction(),
      this.measureSystemHealth()
    ]);

    return {
      strugglePredictionAccuracy: strugglerAccuracy,
      behavioralSignalLatency: signalLatency,
      canvasIntegrationHealth: canvasHealth,
      privacyComplianceRate: privacyCompliance,
      userSatisfactionScore: userSatisfaction,
      systemHealthMetrics: systemHealth
    };
  }

  /**
   * Measure ML model prediction accuracy in real-time
   */
  private async measureStrugglePredictionAccuracy(): Promise<number> {
    try {
      // Get recent predictions and ground truth labels
      const recentPredictions = await this.getRecentPredictions(100);
      if (recentPredictions.length === 0) {
        return 0;
      }

      // Calculate accuracy against validated outcomes
      const groundTruthLabels = await this.getGroundTruthLabels(recentPredictions);
      const accuracy = this.calculateAccuracy(recentPredictions, groundTruthLabels);

      return accuracy;
    } catch (error) {
      console.error('Error measuring prediction accuracy:', error);
      return 0;
    }
  }

  /**
   * Measure behavioral signal processing latency
   */
  private async measureBehavioralSignalLatency(): Promise<{ p50: number; p95: number; p99: number }> {
    try {
      const latencyMetrics = await this.metricsCollector.getLatencyMetrics(
        'behavioral_signal_processing', 
        '10m'
      );
      
      return {
        p50: latencyMetrics.p50,
        p95: latencyMetrics.p95,
        p99: latencyMetrics.p99
      };
    } catch (error) {
      console.error('Error measuring signal latency:', error);
      return { p50: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Measure Canvas integration health metrics
   */
  private async measureCanvasIntegrationHealth(): Promise<{
    messageDeliveryRate: number;
    errorRate: number;
    responseTime: number;
  }> {
    try {
      const integrationMetrics = await this.metricsCollector.getIntegrationMetrics(
        'canvas_postmessage', 
        '10m'
      );

      return {
        messageDeliveryRate: integrationMetrics.successRate,
        errorRate: integrationMetrics.errorRate,
        responseTime: integrationMetrics.averageResponseTime
      };
    } catch (error) {
      console.error('Error measuring Canvas integration health:', error);
      return { messageDeliveryRate: 0, errorRate: 1, responseTime: 0 };
    }
  }

  /**
   * Measure privacy compliance rates
   */
  private async measurePrivacyCompliance(): Promise<{
    consentValidationRate: number;
    dataRetentionCompliance: number;
    anonymizationSuccessRate: number;
  }> {
    try {
      const [consentRate, retentionCompliance, anonymizationRate] = await Promise.all([
        this.metricsCollector.getComplianceMetric('consent_validation_rate', '1h'),
        this.metricsCollector.getComplianceMetric('data_retention_compliance', '24h'),
        this.metricsCollector.getComplianceMetric('anonymization_success_rate', '1h')
      ]);

      return {
        consentValidationRate: consentRate,
        dataRetentionCompliance: retentionCompliance,
        anonymizationSuccessRate: anonymizationRate
      };
    } catch (error) {
      console.error('Error measuring privacy compliance:', error);
      return { consentValidationRate: 0, dataRetentionCompliance: 0, anonymizationSuccessRate: 0 };
    }
  }

  /**
   * Measure user satisfaction with interventions
   */
  private async measureUserSatisfaction(): Promise<number> {
    try {
      // Get recent user feedback on proactive interventions
      const recentFeedback = await this.getUserSatisfactionFeedback('24h');
      if (recentFeedback.length === 0) {
        return 0;
      }

      const averageRating = recentFeedback.reduce((sum, rating) => sum + rating, 0) / recentFeedback.length;
      return averageRating;
    } catch (error) {
      console.error('Error measuring user satisfaction:', error);
      return 0;
    }
  }

  /**
   * Measure system health metrics
   */
  private async measureSystemHealth(): Promise<{
    durableObjectMemoryUsage: number;
    cpuUtilization: number;
    errorRate: number;
    activeUsers: number;
  }> {
    try {
      const [memoryUsage, cpuUsage, errorRate, activeUsers] = await Promise.all([
        this.metricsCollector.getSystemMetric('durable_object_memory_usage', '5m'),
        this.metricsCollector.getSystemMetric('cpu_utilization', '5m'),
        this.metricsCollector.getSystemMetric('error_rate', '5m'),
        this.metricsCollector.getSystemMetric('active_users', '1m')
      ]);

      return {
        durableObjectMemoryUsage: memoryUsage,
        cpuUtilization: cpuUsage,
        errorRate: errorRate,
        activeUsers: activeUsers
      };
    } catch (error) {
      console.error('Error measuring system health:', error);
      return { durableObjectMemoryUsage: 0, cpuUtilization: 0, errorRate: 1, activeUsers: 0 };
    }
  }

  /**
   * Evaluate metrics against alert thresholds
   */
  private async evaluateAlertConditions(metrics: QualityMetrics): Promise<void> {
    for (const threshold of MONITORING_ALERT_THRESHOLDS) {
      const currentValue = this.extractMetricValue(metrics, threshold.metric);
      
      if (currentValue === null) {
        continue;
      }

      // Check critical threshold
      if (this.shouldAlert(currentValue, threshold.criticalLevel, threshold.metric)) {
        await this.alertManager.sendAlert({
          id: `critical-${threshold.metric}-${Date.now()}`,
          metric: threshold.metric,
          severity: 'critical',
          currentValue,
          threshold: threshold.criticalLevel,
          message: `CRITICAL: ${threshold.description} - Current: ${currentValue}, Threshold: ${threshold.criticalLevel}`,
          timestamp: new Date(),
          metadata: { duration: threshold.duration }
        });
      }
      // Check warning threshold
      else if (this.shouldAlert(currentValue, threshold.warningLevel, threshold.metric)) {
        await this.alertManager.sendAlert({
          id: `warning-${threshold.metric}-${Date.now()}`,
          metric: threshold.metric,
          severity: 'warning',
          currentValue,
          threshold: threshold.warningLevel,
          message: `WARNING: ${threshold.description} - Current: ${currentValue}, Threshold: ${threshold.warningLevel}`,
          timestamp: new Date(),
          metadata: { duration: threshold.duration }
        });
      }
    }
  }

  /**
   * Initialize alert rules from configuration
   */
  private async initializeAlertRules(): Promise<void> {
    console.log('🚨 Initializing quality monitoring alert rules...');
    
    for (const threshold of MONITORING_ALERT_THRESHOLDS) {
      await this.alertManager.createAlertRule({
        metric: threshold.metric,
        condition: this.getConditionFromMetric(threshold.metric),
        warningThreshold: threshold.warningLevel,
        criticalThreshold: threshold.criticalLevel,
        duration: threshold.duration,
        enabled: true
      });
    }

    console.log(`✅ Initialized ${MONITORING_ALERT_THRESHOLDS.length} alert rules`);
  }

  /**
   * Extract metric value from metrics object
   */
  private extractMetricValue(metrics: QualityMetrics, metricName: string): number | null {
    switch (metricName) {
      case 'struggle_prediction_accuracy':
        return metrics.strugglePredictionAccuracy;
      case 'behavioral_signal_latency_p95':
        return metrics.behavioralSignalLatency.p95;
      case 'canvas_integration_error_rate':
        return metrics.canvasIntegrationHealth.errorRate;
      case 'privacy_consent_violation_rate':
        return 1 - metrics.privacyComplianceRate.consentValidationRate;
      case 'durable_object_memory_usage':
        return metrics.systemHealthMetrics.durableObjectMemoryUsage;
      case 'user_satisfaction_score':
        return metrics.userSatisfactionScore;
      default:
        console.warn(`Unknown metric: ${metricName}`);
        return null;
    }
  }

  /**
   * Determine if alert should be triggered
   */
  private shouldAlert(currentValue: number, threshold: number, metric: string): boolean {
    // Most metrics alert when value goes above threshold
    // Some metrics (like accuracy, satisfaction) alert when value goes below threshold
    const belowThresholdMetrics = [
      'struggle_prediction_accuracy',
      'user_satisfaction_score'
    ];

    if (belowThresholdMetrics.includes(metric)) {
      return currentValue < threshold;
    } else {
      return currentValue > threshold;
    }
  }

  /**
   * Get condition type for metric
   */
  private getConditionFromMetric(metric: string): 'above' | 'below' {
    const belowThresholdMetrics = [
      'struggle_prediction_accuracy',
      'user_satisfaction_score'
    ];

    return belowThresholdMetrics.includes(metric) ? 'below' : 'above';
  }

  /**
   * Log metrics summary to console
   */
  private logMetricsSummary(metrics: QualityMetrics): void {
    console.log('\n📈 QUALITY METRICS SUMMARY:');
    console.log(`   Struggle Prediction Accuracy: ${(metrics.strugglePredictionAccuracy * 100).toFixed(1)}%`);
    console.log(`   Signal Processing Latency P95: ${metrics.behavioralSignalLatency.p95.toFixed(0)}ms`);
    console.log(`   Canvas Message Delivery Rate: ${(metrics.canvasIntegrationHealth.messageDeliveryRate * 100).toFixed(1)}%`);
    console.log(`   Privacy Consent Validation Rate: ${(metrics.privacyComplianceRate.consentValidationRate * 100).toFixed(1)}%`);
    console.log(`   User Satisfaction Score: ${metrics.userSatisfactionScore.toFixed(1)}/5.0`);
    console.log(`   Active Users: ${metrics.systemHealthMetrics.activeUsers}`);
    console.log(`   Memory Usage: ${metrics.systemHealthMetrics.durableObjectMemoryUsage.toFixed(0)}MB`);
  }

  /**
   * Get recent predictions for accuracy measurement
   */
  private async getRecentPredictions(count: number): Promise<any[]> {
    // Implementation would query recent predictions from database
    return [];
  }

  /**
   * Get ground truth labels for predictions
   */
  private async getGroundTruthLabels(predictions: any[]): Promise<any[]> {
    // Implementation would get validated outcomes
    return [];
  }

  /**
   * Calculate accuracy between predictions and ground truth
   */
  private calculateAccuracy(predictions: any[], groundTruth: any[]): number {
    // Implementation would calculate accuracy metrics
    return 0.75; // Placeholder
  }

  /**
   * Get user satisfaction feedback
   */
  private async getUserSatisfactionFeedback(timeWindow: string): Promise<number[]> {
    // Implementation would query user feedback ratings
    return [4.2, 4.5, 3.8, 4.1, 4.3]; // Placeholder
  }

  /**
   * Sleep utility for monitoring loop
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Metrics Collector Service
 * Handles collection and storage of metrics data
 */
export class MetricsCollector {
  private metrics: Map<string, MetricSeries> = new Map();

  async recordMetrics(metrics: QualityMetrics): Promise<void> {
    const timestamp = new Date();

    // Record individual metrics
    await this.recordMetric('struggle_prediction_accuracy', metrics.strugglePredictionAccuracy, timestamp);
    await this.recordMetric('behavioral_signal_latency_p95', metrics.behavioralSignalLatency.p95, timestamp);
    await this.recordMetric('canvas_integration_health', metrics.canvasIntegrationHealth.messageDeliveryRate, timestamp);
    await this.recordMetric('user_satisfaction_score', metrics.userSatisfactionScore, timestamp);
    
    // Cleanup old metrics
    await this.cleanupOldMetrics();
  }

  async recordMetric(name: string, value: number, timestamp: Date, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        metric: name,
        values: [],
        timeWindow: '30d'
      });
    }

    const series = this.metrics.get(name)!;
    series.values.push({ value, timestamp, metadata });
  }

  async getLatencyMetrics(metric: string, timeWindow: string): Promise<{ p50: number; p95: number; p99: number }> {
    // Implementation would query latency metrics
    return { p50: 45, p95: 95, p99: 180 }; // Placeholder
  }

  async getIntegrationMetrics(integration: string, timeWindow: string): Promise<{ successRate: number; errorRate: number; averageResponseTime: number }> {
    // Implementation would query integration metrics
    return { successRate: 0.995, errorRate: 0.005, averageResponseTime: 150 }; // Placeholder
  }

  async getComplianceMetric(metric: string, timeWindow: string): Promise<number> {
    // Implementation would query compliance metrics
    return 0.999; // Placeholder
  }

  async getSystemMetric(metric: string, timeWindow: string): Promise<number> {
    // Implementation would query system metrics
    switch (metric) {
      case 'durable_object_memory_usage': return 350;
      case 'cpu_utilization': return 65;
      case 'error_rate': return 0.002;
      case 'active_users': return 847;
      default: return 0;
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    for (const [name, series] of this.metrics.entries()) {
      series.values = series.values.filter(value => value.timestamp > cutoffDate);
    }
  }
}

/**
 * Alert Manager Service
 * Handles alert creation, delivery, and management
 */
export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  async sendAlert(alert: Alert): Promise<void> {
    console.warn(`🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.message}`);
    
    // Store alert
    this.alerts.set(alert.id, alert);
    
    // In production, this would integrate with:
    // - Slack/Teams notifications
    // - Email alerts
    // - PagerDuty/OpsGenie
    // - Dashboard notifications
    
    // For now, just log to console
    this.logAlert(alert);
  }

  async createAlertRule(rule: AlertRule): Promise<void> {
    this.alertRules.set(rule.metric, rule);
  }

  private logAlert(alert: Alert): void {
    console.log(`\n🚨 QUALITY ALERT - ${alert.severity.toUpperCase()}`);
    console.log(`   Metric: ${alert.metric}`);
    console.log(`   Current Value: ${alert.currentValue}`);
    console.log(`   Threshold: ${alert.threshold}`);
    console.log(`   Time: ${alert.timestamp.toISOString()}`);
    
    if (alert.metadata) {
      console.log(`   Metadata: ${JSON.stringify(alert.metadata, null, 2)}`);
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => {
        // Consider alerts active for 24 hours
        const alertAge = Date.now() - alert.timestamp.getTime();
        return alertAge < 24 * 60 * 60 * 1000;
      });
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    this.alerts.delete(alertId);
    console.log(`✅ Alert ${alertId} acknowledged and resolved`);
  }
}