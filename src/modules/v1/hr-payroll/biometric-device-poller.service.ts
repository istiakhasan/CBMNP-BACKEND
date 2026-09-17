import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { BiometricDevice, BiometricDeviceStatus } from './entities/biometric-device.entity';
import { HrPayrollService } from './hr-payroll.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ZKLib = require('node-zklib');

const POLL_INTERVAL_MS = 60 * 1000; // check every registered LAN device once a minute
const CONNECT_TIMEOUT_MS = 8000;

function bangladeshDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export interface DeviceSyncResult {
  success: boolean;
  message: string;
  processedCount?: number;
  matchedCount?: number;
}

@Injectable()
export class BiometricDevicePollerService {
  private readonly logger = new Logger(BiometricDevicePollerService.name);
  private readonly syncing = new Set<string>();

  constructor(
    @InjectRepository(BiometricDevice)
    private readonly deviceRepo: Repository<BiometricDevice>,
    private readonly hrPayrollService: HrPayrollService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async pollAllDevices() {
    const devices = await this.deviceRepo.find({
      where: { status: BiometricDeviceStatus.ACTIVE },
    });

    for (const device of devices) {
      if (!device.ipAddress || this.syncing.has(device.id)) continue;
      this.syncing.add(device.id);
      try {
        await this.syncDevice(device);
      } catch (err) {
        this.logger.warn(`Auto-sync failed for device "${device.name}" (${device.ipAddress}): ${err.message}`);
      } finally {
        this.syncing.delete(device.id);
      }
    }
  }

  // Connects to the physical device right now and pulls any new attendance logs.
  // Used both by the background poller above and the "Sync Now" button in the UI.
  async syncDevice(device: BiometricDevice): Promise<DeviceSyncResult> {
    if (!device.ipAddress) {
      const message = 'No IP address configured for this device';
      await this.deviceRepo.update(device.id, { lastConnectionError: message });
      return { success: false, message };
    }

    const zkInstance = new ZKLib(device.ipAddress, device.port || 4370, CONNECT_TIMEOUT_MS, 4000);

    try {
      await zkInstance.createSocket();

      const { data: records } = await zkInstance.getAttendances();
      const today = bangladeshDate(new Date());

      // A device may retain years of history. Sync only Bangladesh's current
      // calendar day; ingestPunchLogs makes this idempotent, so a retry cannot
      // duplicate a punch.
      let maxRecordTime: Date | null = null;
      const rawLogs = (records || [])
        .filter((r: any) => r.recordTime && bangladeshDate(r.recordTime) === today)
        .map((r: any) => {
          const recordTime = new Date(r.recordTime);
          if (!maxRecordTime || recordTime > maxRecordTime) maxRecordTime = recordTime;
          return {
            biometricUserId: String(r.deviceUserId),
            timestamp: r.recordTime,
            punchType: 'Auto',
            verifyType: 'Fingerprint',
          };
        });

      let processedCount = 0;
      let matchedCount = 0;
      if (rawLogs.length > 0) {
        const result = await this.hrPayrollService.ingestPunchLogs(device, device.organizationId, rawLogs);
        processedCount = result.processedCount;
        matchedCount = result.matchedCount;
      }

      await this.deviceRepo.update(device.id, {
        lastSyncAt: new Date(),
        lastConnectionError: null,
        ...(maxRecordTime ? { lastPolledRecordTime: maxRecordTime } : {}),
      });

      return {
        success: true,
        message:
          processedCount > 0
            ? `Connected successfully. ${processedCount} new punch(es) synced (${matchedCount} matched to employees).`
            : 'Connected successfully. No new punches since last sync.',
        processedCount,
        matchedCount,
      };
    } catch (err: any) {
      const message = this.describeConnectionError(err);
      await this.deviceRepo.update(device.id, { lastConnectionError: message });
      return { success: false, message };
    } finally {
      try {
        await zkInstance.disconnect();
      } catch {
        // device may already be unreachable; nothing to clean up
      }
    }
  }

  async syncDeviceById(deviceId: string, organizationId: string): Promise<DeviceSyncResult> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');
    return this.syncDevice(device);
  }

  // Live roster of fingerprints/users actually enrolled ON the physical device
  // (different from "who punched today" — this is the device's own user list).
  async getEnrolledUsers(deviceId: string, organizationId: string) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');
    if (!device.ipAddress) {
      return { success: false, message: 'No IP address configured for this device', users: [] };
    }

    const zkInstance = new ZKLib(device.ipAddress, device.port || 4370, CONNECT_TIMEOUT_MS, 4000);
    try {
      await zkInstance.createSocket();
      const { data } = await zkInstance.getUsers();
      const users = (data || []).map((u: any) => ({
        deviceUserId: u.userId,
        name: u.name || `User ${u.userId}`,
        cardNumber: u.cardno || null,
      }));
      await this.deviceRepo.update(device.id, { lastConnectionError: null });
      return { success: true, message: `${users.length} user(s) enrolled on device`, users };
    } catch (err: any) {
      const message = this.describeConnectionError(err);
      await this.deviceRepo.update(device.id, { lastConnectionError: message });
      return { success: false, message, users: [] };
    } finally {
      try {
        await zkInstance.disconnect();
      } catch {
        // device may already be unreachable; nothing to clean up
      }
    }
  }

  private describeConnectionError(err: any): string {
    if (err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '')) {
      return `Connection timeout — device unreachable at this IP/port`;
    }
    if (err?.code === 'ECONNREFUSED') {
      return `Connection refused — check the device port and network`;
    }
    if (err?.code === 'EHOSTUNREACH' || err?.code === 'ENETUNREACH') {
      return `Host unreachable — check the device IP and network cable`;
    }
    return err?.message || 'Failed to connect to device';
  }
}
