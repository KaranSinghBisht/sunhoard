use sha2::{Digest, Sha256};

use super::numbers::PPM;

pub fn ppm_of(n: u32) -> u32 {
    ((u64::from(n) * u64::from(PPM)) / (1u64 << 32)) as u32
}

pub fn expand(seed: &[u8; 32], step: u64) -> [u8; 32] {
    hash_parts(seed, &step.to_le_bytes(), &[])
}

pub fn expand_hit(seed: &[u8; 32], step: u64, hit: u16) -> [u8; 32] {
    hash_parts(seed, &step.to_le_bytes(), &hit.to_le_bytes())
}

fn hash_parts(seed: &[u8; 32], step: &[u8], extra: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(seed);
    hasher.update(step);
    hasher.update(extra);
    finish(hasher)
}

pub(crate) fn finish(hasher: Sha256) -> [u8; 32] {
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

#[cfg(test)]
mod tests {
    use super::{expand, expand_hit, ppm_of};

    #[test]
    fn ppm_covers_the_range_without_reaching_one_million() {
        assert_eq!(ppm_of(0), 0);
        assert!(ppm_of(u32::MAX) < 1_000_000);
        assert_eq!(ppm_of(3_006_477_108), 700_000);
        assert_eq!(ppm_of(3_006_477_107), 699_999);
    }

    #[test]
    fn expand_changes_when_the_step_changes() {
        let seed = [7u8; 32];
        assert_ne!(expand(&seed, 0), expand(&seed, 1));
        assert_ne!(expand_hit(&seed, 1, 0), expand_hit(&seed, 1, 1));
        assert_eq!(expand(&seed, 4), expand(&seed, 4));
    }
}
