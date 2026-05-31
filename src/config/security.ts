/**
 * SSL Pinning & Certificate Transparency configuration
 *
 * SHA-256 fingerprints of the API server's TLS certificate(s).
 * Include both the active cert and the next rotation cert so deploys
 * are zero-downtime.
 *
 * To obtain a fingerprint:
 *   openssl s_client -connect api.petchain.app:443 </dev/null 2>/dev/null \
 *     | openssl x509 -noout -fingerprint -sha256
 */
export const SSL_PINS: Record<string, string[]> = {
  'api.petchain.app': [
    // Primary certificate (rotate before expiry)
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    // Backup / next rotation certificate
    'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  ],
  'staging.petchain.app': [
    'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
  ],
};

/** Domains that require certificate pinning */
export const PINNED_DOMAINS = Object.keys(SSL_PINS);

/**
 * How long (ms) to cache a successful pin validation before re-checking.
 * Keeps UX snappy while still catching rotations promptly.
 */
export const PIN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Support contact shown to the user when a pin failure occurs.
 * A pin failure almost always means a MITM attack or an expired cert.
 */
export const PIN_FAILURE_SUPPORT_URL = 'https://petchain.app/support';

/**
 * Certificate Transparency: minimum number of SCTs required.
 * Set to 0 to disable CT enforcement (not recommended for production).
 */
export const CT_MIN_SCTS = 2;
