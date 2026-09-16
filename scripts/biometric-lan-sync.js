/*
 * Run this script on a computer in the SAME LAN as the biometric device.
 * It sends only today's Bangladesh attendance + the enrolled user roster to
 * the SaaS API. It never reads or transfers fingerprint templates.
 *
 * Node 20+: node --env-file=.env scripts/biometric-lan-sync.js
 * Required .env values:
 * BIOMETRIC_DEVICE_IP=192.168.30.44
 * BIOMETRIC_DEVICE_PORT=4370
 * BIOMETRIC_DEVICE_ID=<production biometric device UUID>
 * BIOMETRIC_DEVICE_API_KEY=<production device API key>
 * BIOMETRIC_CLOUD_API_URL=https://api.tabaya.com/api/v1
 */
const axios = require('axios');
const ZKLib = require('node-zklib');

const required = [
  'BIOMETRIC_DEVICE_IP',
  'BIOMETRIC_DEVICE_ID',
  'BIOMETRIC_DEVICE_API_KEY',
  'BIOMETRIC_CLOUD_API_URL',
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const config = {
  deviceIp: process.env.BIOMETRIC_DEVICE_IP,
  devicePort: Number(process.env.BIOMETRIC_DEVICE_PORT || 4370),
  deviceId: process.env.BIOMETRIC_DEVICE_ID,
  apiKey: process.env.BIOMETRIC_DEVICE_API_KEY,
  apiBaseUrl: process.env.BIOMETRIC_CLOUD_API_URL.replace(/\/$/, ''),
  intervalMs: Number(process.env.BIOMETRIC_SYNC_INTERVAL_MS || 60_000),
};
const attendanceBatchSize = Number(process.env.BIOMETRIC_ATTENDANCE_BATCH_SIZE || 100);
let syncing = false;

function bangladeshDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

async function sync() {
  if (syncing) return;
  syncing = true;
  const device = new ZKLib(config.deviceIp, config.devicePort, 8_000, 4_000);
  try {
    await device.createSocket();
    // node-zklib uses one device socket; read sequentially to avoid overlapping
    // protocol commands on the same biometric connection.
    const { data: attendance = [] } = await device.getAttendances();
    const { data: enrolledUsers = [] } = await device.getUsers();

    const todayInBangladesh = bangladeshDate(new Date());
    // Re-send today's records on every run. The API de-duplicates by
    // organization + device user + timestamp, and can therefore relink a
    // record after an administrator re-registers the same physical device.
    const freshAttendance = attendance
      .filter(
        (row) =>
          row?.recordTime &&
          bangladeshDate(row.recordTime) === todayInBangladesh,
      )
      .sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime());

    const headers = { 'x-device-api-key': config.apiKey };
    if (freshAttendance.length) {
      for (let offset = 0; offset < freshAttendance.length; offset += attendanceBatchSize) {
        const batch = freshAttendance.slice(offset, offset + attendanceBatchSize);
        await axios.post(
          `${config.apiBaseUrl}/hr-payroll/biometric/sync`,
          {
            logs: batch.map((row) => ({
              biometricUserId: String(row.deviceUserId),
              timestamp: new Date(row.recordTime).toISOString(),
              punchType: 'Auto',
              verifyType: 'Fingerprint',
            })),
          },
          { headers, timeout: 30_000 },
        );
      }
    }

    // The API uses an upsert keyed by organization + device + device user ID,
    // so this full roster can be sent every minute without creating duplicates.
    const rosterResponse = await axios.post(
      `${config.apiBaseUrl}/hr-payroll/biometric/devices/${config.deviceId}/enrolled-users/sync`,
      {
        users: enrolledUsers.map((user) => ({
          deviceUserId: String(user.userId),
          name: user.name || null,
          cardNumber: user.cardno || null,
        })),
      },
      { headers, timeout: 30_000 },
    );

    console.log(
      `[${new Date().toISOString()}] ${freshAttendance.length} new punch(es); ${rosterResponse.data?.data?.users?.length || 0} enrolled user(s) cached.`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Biometric sync failed:`, error.response?.data || error.message);
  } finally {
    try {
      await device.disconnect();
    } catch {
      // The device may have already closed the socket.
    }
    syncing = false;
  }
}

sync();
setInterval(sync, config.intervalMs);
