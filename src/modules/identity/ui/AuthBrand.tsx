// Brand block shared by the auth screens (design class .auth-brand, screens S01.1 and S01.2):
// logo mark in a rounded gradient tile, platform name, tagline.

import { brandTextAr as t } from './messages.ar';
import styles from './auth.module.css';

export function AuthBrand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}>
        <img src="/brand/logo-mark-white.svg" alt={t.logoAlt} width={44} height={33} />
      </span>
      <strong className={styles.brandName}>{t.name}</strong>
      <p className={styles.tagline}>{t.tagline}</p>
    </div>
  );
}
