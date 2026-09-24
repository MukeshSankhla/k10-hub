import { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Copy,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Power,
  Layers,
  Activity,
  RotateCcw,
  Check,
  Smartphone,
} from 'lucide-react';
import { ProjectDetail, FirmwareConfig } from '../../config/projectsData';
import { serialService, ConnectedDeviceInfo } from '../../services/flasher/serialService';
import { downloadService } from '../../services/flasher/downloadService';
import { flasherService } from '../../services/flasher/flasherService';
import { logger, LogEntry } from '../../services/flasher/loggerService';
import { incrementProjectFlashCount } from '../../services/flasher/flashCountService';

interface WebFlasherPanelProps {
  project: ProjectDetail;
  onFlashSuccess?: () => void;
}

type FlashPhase =
  | 'idle'
  | 'connecting'
  | 'downloading'
  | 'flashing'
  | 'verifying'
  | 'rebooting'
  | 'completed'
  | 'error';

export default function WebFlasherPanel({ project, onFlashSuccess }: WebFlasherPanelProps) {
  // Active selected firmware
  const [selectedFwIndex, setSelectedFwIndex] = useState(0);
  const activeFw: FirmwareConfig = project.firmwares[selectedFwIndex] || project.firmwares[0];

  // Serial Connection State
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<ConnectedDeviceInfo | null>(null);
  const [baudRate, setBaudRate] = useState<number>(serialService.isMobile() ? 460800 : 921600);
  const [flagCopied, setFlagCopied] = useState(false);
  const [showBaudSettings, setShowBaudSettings] = useState(false);

  const isMobile = serialService.isMobile();
  const isAndroidChrome = serialService.isAndroidChrome();
  const isIOS = serialService.isIOS();

  const handleCopyChromeFlag = async () => {
    try {
      await navigator.clipboard.writeText('chrome://flags#enable-web-serial-on-android');
      setFlagCopied(true);
      setTimeout(() => setFlagCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  // Flashing State
  const [phase, setPhase] = useState<FlashPhase>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatusText, setProgressStatusText] = useState('');
  const [progressSubText, setProgressSubText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Serial Monitor / Console State
  const [showConsole, setShowConsole] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serialTxText, setSerialTxText] = useState('');
  const [lineEnding, setLineEnding] = useState<'NL' | 'CR' | 'NLCR'>('NL');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Serial Monitor Polling reader
  const monitorIntervalRef = useRef<any>(null);

  // Check Web Serial support on mount
  useEffect(() => {
    setIsBrowserSupported(serialService.checkBrowserSupport());
  }, []);

  // Subscribe to logger entries
  useEffect(() => {
    const unsubscribe = logger.subscribe((_entry, allLogs) => {
      setLogs([...allLogs]);
    });
    return () => unsubscribe();
  }, []);

  // Auto-scroll terminal internally without scrolling the entire project page
  useEffect(() => {
    if (showConsole && autoScroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs, showConsole, autoScroll]);

  // Clean up serial connection on unmount
  useEffect(() => {
    return () => {
      stopSerialMonitor();
      serialService.disconnectDevice().catch(() => {});
    };
  }, []);

  // Serial Monitor Stream Loop
  const startSerialMonitor = () => {
    const transport = serialService.getTransport();
    if (!transport) return;

    const decoder = new TextDecoder();
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
    }

    monitorIntervalRef.current = setInterval(() => {
      if (transport.buffer && transport.buffer.length > 0) {
        const chunk = transport.buffer;
        transport.flushInput();
        try {
          const text = decoder.decode(chunk);
          if (text && text.trim()) {
            logger.rx(text);
          }
        } catch {
          // safe catch for partial utf-8 chunks
        }
      }
    }, 60);
  };

  const stopSerialMonitor = () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  };

  // Connect to board
  const handleConnect = async (): Promise<boolean> => {
    setErrorMessage('');
    setIsConnecting(true);
    try {
      await serialService.requestPort();
      const info = await serialService.connectDevice(baudRate, () => {
        setIsConnected(false);
        setDeviceInfo(null);
        stopSerialMonitor();
        logger.warn('Device was disconnected from USB port.');
      });

      setDeviceInfo(info);
      setIsConnected(true);
      setIsConnecting(false);
      startSerialMonitor();
      return true;
    } catch (err: any) {
      setIsConnecting(false);
      setIsConnected(false);
      setDeviceInfo(null);
      stopSerialMonitor();

      let msg = err.message || 'Connection failed';
      if (msg.includes('Permission Denied') || msg.includes('No port selected')) {
        msg = 'Port selection was cancelled or permission denied.';
      }
      setErrorMessage(msg);
      return false;
    }
  };

  // Disconnect from board
  const handleDisconnect = async () => {
    stopSerialMonitor();
    await serialService.disconnectDevice();
    setIsConnected(false);
    setDeviceInfo(null);
    setPhase('idle');
  };

  // Reset / Reboot hardware
  const handleRebootDevice = async () => {
    const currentLoader = serialService.getLoader();
    if (!currentLoader) return;
    try {
      logger.log('Sending hardware reset command to microcontroller...');
      await flasherService.resetDevice(currentLoader);
      logger.log('Microcontroller reset triggered. Monitoring reboot output...');
    } catch (err: any) {
      logger.error(`Hardware reboot failed: ${err.message}`);
    }
  };

  // Start complete Download & Flash pipeline
  const handleStartFlash = async () => {
    if (phase === 'flashing' || phase === 'downloading' || phase === 'verifying') return;
    setErrorMessage('');

    // Ensure device is connected first
    let currentLoader = serialService.getLoader();
    if (!serialService.isConnected() || !currentLoader) {
      const connected = await handleConnect();
      if (!connected) return;
      currentLoader = serialService.getLoader();
    }

    if (!currentLoader) {
      setErrorMessage('Failed to initialize connection to microcontroller.');
      return;
    }

    // Stop serial monitor temporarily so port write lock is released
    stopSerialMonitor();
    await new Promise((r) => setTimeout(r, 80));

    try {
      // Step 1: Downloading binary from remote URL
      setPhase('downloading');
      setProgressPercent(0);
      setProgressStatusText(`Downloading ${activeFw.name}...`);
      setProgressSubText('Fetching precompiled binary from storage...');

      const binaryData = await downloadService.downloadFile(activeFw.firmwareUrl, (downloaded, total) => {
        if (total > 0) {
          const pct = Math.min(100, Math.round((downloaded / total) * 100));
          setProgressPercent(pct);
          setProgressStatusText(`Downloading firmware (${pct}%)...`);
          setProgressSubText(`${downloadService.formatBytes(downloaded)} / ${downloadService.formatBytes(total)}`);
        } else {
          setProgressStatusText('Downloading firmware binary...');
          setProgressSubText(downloadService.formatBytes(downloaded));
        }
      });

      logger.log(`Binary downloaded: ${downloadService.formatBytes(binaryData.length)}.`);

      // Step 2: Flashing memory blocks
      setPhase('flashing');
      setProgressPercent(0);
      setProgressStatusText(`Flashing ROM at ${activeFw.flashAddress}...`);
      setProgressSubText(`Target payload: ${downloadService.formatBytes(binaryData.length)}`);

      await flasherService.flashFile(
        currentLoader,
        binaryData,
        activeFw.flashAddress,
        (written, total) => {
          if (total > 0) {
            const pct = Math.min(100, Math.round((written / total) * 100));
            if (pct < 99) {
              setProgressPercent(pct);
              setProgressStatusText(`Writing Flash (${pct}%)...`);
              setProgressSubText(`${downloadService.formatBytes(written)} / ${downloadService.formatBytes(total)}`);
            }
          }
        },
        () => {
          // Step 3: Hardware MD5 Checksum Verification
          setPhase('verifying');
          setProgressPercent(99);
          setProgressStatusText('Verifying flash integrity (MD5 Checksum)...');
          setProgressSubText('Validating written memory blocks against remote hash...');
        }
      );

      // Flash verified successfully!
      setProgressPercent(100);
      setProgressStatusText('Flash verified successfully!');
      setProgressSubText('MD5 hash verified. Resetting chip...');
      await new Promise((r) => setTimeout(r, 600));

      // Step 4: Hardware Reset & Reboot
      setPhase('rebooting');
      setProgressStatusText('Executing hardware reset...');
      setProgressSubText('Toggling DTR/RTS lines to boot new firmware...');

      await flasherService.resetDevice(currentLoader);
      await new Promise((r) => setTimeout(r, 500));

      // Step 5: Completed!
      setPhase('completed');
      logger.log(`Flash sequence completed successfully for ${activeFw.name}!`);

      // Increment flash count
      incrementProjectFlashCount(project.id, activeFw.version).catch((err) => {
        console.warn('Flash count increment notice:', err);
      });

      // Resume serial monitor
      startSerialMonitor();

      // Trigger success modal & parent callback
      setShowSuccessModal(true);
      if (onFlashSuccess) {
        onFlashSuccess();
      }
    } catch (err: any) {
      logger.error(`Flashing aborted: ${err.message}`);
      setPhase('error');
      setErrorMessage(err.message || 'Flashing procedure failed');

      if (serialService.isConnected()) {
        startSerialMonitor();
      }
    }
  };

  // Transmit command to device via Serial Tx
  const handleSendSerialTx = async () => {
    if (!serialTxText.trim()) return;
    const esploader = serialService.getLoader();
    if (!esploader || !esploader.transport) {
      logger.error('Tx Failed: Serial port is not connected.');
      return;
    }

    let payload = serialTxText;
    if (lineEnding === 'NL') payload += '\n';
    else if (lineEnding === 'CR') payload += '\r';
    else if (lineEnding === 'NLCR') payload += '\r\n';

    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    try {
      const transport = esploader.transport;
      if (transport && transport.device && transport.device.writable) {
        const writer = transport.device.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();

        logger.tx(payload);
        setSerialTxText('');
      } else {
        logger.error('Failed to send data: Serial port is not writable.');
      }
    } catch (error: any) {
      logger.error(`Serial write error: ${error.message}`);
    }
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 1500);
    });
  };

  const isFlashingActive =
    phase === 'downloading' || phase === 'flashing' || phase === 'verifying' || phase === 'rebooting';

  return (
    <div
      style={{
        position: 'sticky',
        top: 'calc(var(--nav-height) + var(--space-4))',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ padding: 'var(--space-6)' }}>
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 'var(--space-5)',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-ink-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cpu size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-ink-primary)', letterSpacing: '-0.01em' }}>
                  1-Click Web Flasher
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-ink-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>
                ESP-IDF Web Serial Flasher
              </span>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: isConnected
                ? 'rgba(16, 185, 129, 0.1)'
                : isConnecting
                ? 'rgba(245, 158, 11, 0.1)'
                : 'var(--color-paper)',
              border: isConnected
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : isConnecting
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : '1px solid var(--color-border)',
              color: isConnected
                ? 'rgb(16, 185, 129)'
                : isConnecting
                ? 'rgb(217, 119, 6)'
                : 'var(--color-ink-tertiary)',
              boxShadow: isConnected ? '0 0 10px rgba(16, 185, 129, 0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isConnected
                  ? 'rgb(16, 185, 129)'
                  : isConnecting
                  ? 'rgb(245, 158, 11)'
                  : 'var(--color-ink-tertiary)',
                boxShadow: isConnected ? '0 0 6px rgb(16, 185, 129)' : 'none',
              }}
            />
            <span>
              {isConnecting
                ? 'Connecting...'
                : isConnected
                ? deviceInfo?.chipName || 'ESP32 Connected'
                : 'Ready'}
            </span>
          </div>
        </div>

        {/* Mobile Web Serial Ready Card (When supported on Mobile) */}
        {isBrowserSupported && isMobile && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: 'var(--space-4)',
              fontSize: '12px',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, marginBottom: '4px' }}>
              <Smartphone size={16} />
              <span>Mobile Web Serial Ready (USB-OTG)</span>
            </div>
            <p style={{ margin: 0, color: 'var(--color-ink-secondary)', fontSize: '11.5px' }}>
              Connect your UNIHIKER K10 with a USB-C to USB-C cable or USB-OTG adapter. When you tap <strong>Flash Firmware</strong>, tap <strong>Allow</strong> when Android asks for USB device permission.
            </p>
            <div style={{ marginTop: '6px', fontSize: '10.5px', color: 'var(--color-ink-tertiary)' }}>
              💡 <em>Phone not seeing K10? Ensure &ldquo;OTG Connection&rdquo; is toggled ON in Android Settings.</em>
            </div>
          </div>
        )}

        {/* Browser Web Serial Setup / Warnings when Unsupported */}
        {!isBrowserSupported && (
          <>
            {isAndroidChrome ? (
              <div
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.07)',
                  border: '1px solid rgba(37, 99, 235, 0.28)',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: 'var(--space-4)',
                  fontSize: '12px',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontWeight: 700, marginBottom: '6px' }}>
                  <Smartphone size={16} />
                  <span>Flash from Chrome on Android (USB-OTG)</span>
                </div>
                <p style={{ margin: '0 0 10px 0', color: 'var(--color-ink-secondary)', fontSize: '11.5px' }}>
                  Google Chrome on Android supports Web Serial flashing over USB-OTG! Enable Chrome&apos;s Web Serial feature flag once to start flashing directly from your phone:
                </p>

                {/* 1-Tap Copy Flag Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    marginBottom: '10px',
                  }}
                >
                  <code style={{ fontSize: '11px', color: 'var(--color-ink-primary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    chrome://flags#enable-web-serial-on-android
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyChromeFlag}
                    className="btn btn--secondary btn--sm"
                    style={{
                      flexShrink: 0,
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: flagCopied ? '#10b981' : undefined,
                      color: flagCopied ? '#fff' : undefined,
                      borderColor: flagCopied ? '#10b981' : undefined,
                    }}
                  >
                    {flagCopied ? (
                      <>
                        <Check size={12} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Flag URL</span>
                      </>
                    )}
                  </button>
                </div>

                <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--color-ink-secondary)', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Open a new tab, paste the URL into your Chrome address bar, and press Enter.</li>
                  <li>Set <strong>Enable Web Serial on Android</strong> to <strong>Enabled</strong>.</li>
                  <li>Tap the blue <strong>Relaunch</strong> button at the bottom of Chrome.</li>
                  <li>Plug your UNIHIKER K10 with an OTG cable and return here to flash!</li>
                </ol>
              </div>
            ) : isIOS ? (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: 'var(--space-4)',
                  color: 'rgb(220, 38, 38)',
                  fontSize: '12px',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
                  <Smartphone size={16} />
                  <span>iOS Safari / WebKit Limitation</span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px' }}>
                  Apple iOS restricts hardware USB OTG and Web Serial access in all browsers. To flash your K10, please use <strong>Google Chrome on Android</strong> (with OTG cable) or a <strong>PC / Mac / Linux</strong> computer.
                </p>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: 'var(--space-4)',
                  color: 'rgb(220, 38, 38)',
                  fontSize: '12px',
                  lineHeight: 1.45,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Web Serial API is unavailable in this browser. Please open this page in <strong>Google Chrome</strong>,{' '}
                  <strong>Microsoft Edge</strong>, or Chromium on desktop (or Chrome on Android via USB-OTG).
                </span>
              </div>
            )}
          </>
        )}

        {/* Firmware Version Selection Section */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-ink-secondary)',
              marginBottom: '6px',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={13} style={{ color: 'var(--color-accent)' }} />
              <span>Target Firmware</span>
            </span>
            {activeFw.releaseDate && (
              <span style={{ fontSize: '10px', color: 'var(--color-ink-tertiary)', fontWeight: 500 }}>
                Released {activeFw.releaseDate}
              </span>
            )}
          </div>

          {/* Firmware Select Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedFwIndex}
              onChange={(e) => !isFlashingActive && setSelectedFwIndex(Number(e.target.value))}
              disabled={isFlashingActive}
              style={{
                width: '100%',
                padding: '10px 36px 10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-paper)',
                color: 'var(--color-ink-primary)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: isFlashingActive ? 'not-allowed' : 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                transition: 'border-color 0.15s ease',
              }}
            >
              {project.firmwares.map((fw, idx) => (
                <option key={idx} value={idx}>
                  {fw.name} ({fw.version})
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-ink-tertiary)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Clean Hardware Specs Mini-Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-tertiary)', fontWeight: 600 }}>
                Flash Offset
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--color-ink-primary)' }}>
                {activeFw.flashAddress || '0x0000'}
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-tertiary)', fontWeight: 600 }}>
                Version Tag
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)' }}>
                {activeFw.version || 'v1.0.0'}
              </span>
            </div>

            <div
              onClick={() => setShowBaudSettings(!showBaudSettings)}
              title="Click to customize serial baud rate"
              style={{
                backgroundColor: 'var(--color-paper)',
                border: showBaudSettings ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-ink-tertiary)', fontWeight: 600 }}>
                  Baud Rate
                </span>
                <span style={{ fontSize: '9px', color: 'var(--color-accent)' }}>⚙</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                {(baudRate / 1000).toFixed(1)}k bps
              </span>
            </div>
          </div>

          {/* Collapsible Baud Rate Picker */}
          {showBaudSettings && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 10px',
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-secondary)' }}>
                Serial Baud:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[921600, 460800, 115200].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setBaudRate(rate)}
                    disabled={isFlashingActive}
                    style={{
                      border: baudRate === rate ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                      backgroundColor: baudRate === rate ? 'rgba(29, 78, 216, 0.08)' : 'var(--color-surface)',
                      color: baudRate === rate ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '10.5px',
                      fontWeight: baudRate === rate ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {rate === 921600 ? '921.6k (PC)' : rate === 460800 ? '460.8k (OTG)' : '115.2k (Safe)'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Multi-Stage Flashing Progress Bar */}
        {isFlashingActive && (
          <div
            style={{
              backgroundColor: 'var(--color-paper)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: 'var(--space-4)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {/* Step Indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
              <span style={{ fontWeight: 600, color: phase === 'downloading' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)' }}>
                1. Download
              </span>
              <span style={{ color: 'var(--color-ink-tertiary)' }}>→</span>
              <span style={{ fontWeight: 600, color: phase === 'flashing' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)' }}>
                2. Write Flash
              </span>
              <span style={{ color: 'var(--color-ink-tertiary)' }}>→</span>
              <span style={{ fontWeight: 600, color: phase === 'verifying' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)' }}>
                3. Verify MD5
              </span>
              <span style={{ color: 'var(--color-ink-tertiary)' }}>→</span>
              <span style={{ fontWeight: 600, color: phase === 'rebooting' ? 'var(--color-accent)' : 'var(--color-ink-tertiary)' }}>
                4. Reboot
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-ink-primary)' }}>
                {progressStatusText}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-accent)', fontFamily: 'ui-monospace, monospace' }}>
                {progressPercent}%
              </span>
            </div>

            {/* Solid Progress bar */}
            <div
              style={{
                width: '100%',
                height: 6,
                backgroundColor: 'var(--color-border)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  borderRadius: '10px',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-ink-tertiary)' }}>
              <span>{progressSubText}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Activity size={11} className="animate-pulse" />
                <span>Streaming</span>
              </span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: 'var(--space-4)',
              color: 'rgb(220, 38, 38)',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, lineHeight: 1.35 }}>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="btn btn--ghost btn--sm"
              style={{ padding: '0 4px', fontSize: '11px', color: 'rgb(220, 38, 38)' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 'var(--space-5)' }}>
          <button
            type="button"
            onClick={handleStartFlash}
            disabled={!isBrowserSupported || isFlashingActive}
            className="btn btn--primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '12px var(--space-4)',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius: '8px',
              boxShadow: 'none',
              backgroundColor: isConnected
                ? '#059669'
                : 'var(--color-ink-primary)',
              color: 'var(--color-paper)',
              border: 'none',
              cursor: (!isBrowserSupported || isFlashingActive) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isFlashingActive ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Flashing Firmware...</span>
              </>
            ) : isConnecting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Connecting to Device...</span>
              </>
            ) : isConnected ? (
              <>
                <Cpu size={16} />
                <span>Flash {activeFw.name}</span>
              </>
            ) : (
              <>
                <Cpu size={16} />
                <span>Connect & Flash Device</span>
              </>
            )}
          </button>

          {/* Connected Hardware Quick Actions Bar */}
          {isConnected && !isFlashingActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleRebootDevice}
                className="btn btn--secondary btn--sm"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  padding: '6px 10px',
                }}
                title="Send software reset signal to reboot microcontroller"
              >
                <RotateCcw size={12} />
                <span>Reboot Chip</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="btn btn--secondary btn--sm"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  padding: '6px 10px',
                  color: '#dc2626',
                }}
                title="Close serial port connection"
              >
                <Power size={12} />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>

        {/* Web Serial Terminal / Monitor Section */}
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Terminal Title Bar */}
          <div
            onClick={() => setShowConsole(!showConsole)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              cursor: 'pointer',
              userSelect: 'none',
              borderBottom: showConsole ? '1px solid #334155' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Terminal Window Dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <Terminal size={13} color="#38bdf8" />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: '#f8fafc' }}>
                  WEB SERIAL MONITOR
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  ({logs.length} events)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  letterSpacing: '0.04em',
                }}
              >
                921.6K BAUD
              </span>
              <div style={{ color: '#94a3b8' }}>
                {showConsole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
          </div>

          {showConsole && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Terminal Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 10px',
                  borderBottom: '1px solid #1e293b',
                  backgroundColor: '#131d31',
                  fontSize: '10px',
                  color: '#94a3b8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <span style={{ color: '#64748b' }}>Endings:</span>
                    <select
                      value={lineEnding}
                      onChange={(e: any) => setLineEnding(e.target.value)}
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        backgroundColor: '#1e293b',
                        color: '#cbd5e1',
                        outline: 'none',
                      }}
                    >
                      <option value="NL">NL (\n)</option>
                      <option value="CR">CR (\r)</option>
                      <option value="NLCR">Both (\r\n)</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => setAutoScroll(!autoScroll)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: autoScroll ? '#38bdf8' : '#64748b',
                      fontSize: '10px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                    }}
                    title="Toggle auto-scroll to bottom"
                  >
                    Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedLogs ? '#34d399' : '#cbd5e1',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 4px',
                    }}
                    title="Copy full serial logs"
                  >
                    {copiedLogs ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => logger.clear()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 4px',
                    }}
                    title="Clear serial logs"
                  >
                    <Trash2 size={11} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Terminal Screen */}
              <div
                ref={terminalContainerRef}
                style={{
                  height: 160,
                  overflowY: 'auto',
                  padding: '10px 12px',
                  backgroundColor: '#090d16',
                  color: '#e2e8f0',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize: '11px',
                  lineHeight: 1.5,
                }}
              >
                {logs.length === 0 ? (
                  <div style={{ color: '#475569', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                    Serial monitor active. Connect your K10 device to stream boot and UART logs.
                  </div>
                ) : (
                  logs.map((log, i) => {
                    let color = '#38bdf8'; // info
                    if (log.type === 'warn') color = '#fbbf24';
                    if (log.type === 'error') color = '#f87171';
                    if (log.type === 'rx') color = '#34d399';
                    if (log.type === 'tx') color = '#a78bfa';
                    if (log.type === 'system') color = '#94a3b8';

                    return (
                      <div key={i} style={{ wordBreak: 'break-all', marginBottom: 2 }}>
                        <span style={{ color: '#475569', marginRight: 6, fontSize: '10px' }}>
                          [{log.timestamp}]
                        </span>
                        <span style={{ color }}>{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Terminal Command Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderTop: '1px solid #1e293b',
                  backgroundColor: '#0f172a',
                  gap: 6,
                }}
              >
                <span style={{ color: '#38bdf8', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, paddingLeft: 4 }}>
                  &gt;
                </span>
                <input
                  type="text"
                  value={serialTxText}
                  onChange={(e) => setSerialTxText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendSerialTx();
                  }}
                  disabled={!isConnected || isFlashingActive}
                  placeholder={isConnected ? 'Type command and press Enter...' : 'Connect device to send serial commands'}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: '4px',
                    border: '1px solid #334155',
                    backgroundColor: '#090d16',
                    color: '#f8fafc',
                    fontSize: '11px',
                    outline: 'none',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendSerialTx}
                  disabled={!isConnected || isFlashingActive || !serialTxText.trim()}
                  className="btn btn--primary btn--sm"
                  style={{
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    borderRadius: '4px',
                  }}
                >
                  <Send size={11} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flash Success Celebration Modal */}
      {showSuccessModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: 460,
              padding: 'var(--space-8)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'rgb(16, 185, 129)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}
            >
              <CheckCircle2 size={34} />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-ink-primary)', margin: '0 0 var(--space-2) 0' }}>
              Firmware Flashed Successfully!
            </h2>

            <p style={{ fontSize: '13px', color: 'var(--color-ink-secondary)', lineHeight: 1.55, margin: '0 0 var(--space-6) 0' }}>
              <strong>{activeFw.name}</strong> ({activeFw.version}) has been written to flash ROM and verified with MD5 checksum. The board has rebooted into the application.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="btn btn--primary"
                style={{ padding: '8px 28px', borderRadius: '8px', fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
