use sha2::{Digest, Sha256};

use crate::errors::LogicError;

use super::ids::SHELL_CRATER;
use super::numbers::{DUST_HUNDREDTHS, DUST_PPM, GRADE_PPM, PAIR_PPM_LARGE, THAW_FEE_HUNDREDTHS};
use super::roll::{finish, ppm_of};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Gem {
    pub tone: u8,
    pub grade: u8,
    pub purity_bp: u16,
    pub pattern: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RevealedShell {
    pub dust_hundredths: u64,
    pub gems: [Option<Gem>; 2],
}

pub fn seal_key(salt: &[u8; 32], item_id: u64) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(salt);
    hasher.update(item_id.to_le_bytes());
    finish(hasher)
}

pub fn thaw_fee(shell: u8) -> Result<u64, LogicError> {
    THAW_FEE_HUNDREDTHS
        .get(usize::from(shell))
        .copied()
        .ok_or(LogicError::BadShell)
}

pub fn commitment(key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(key);
    finish(hasher)
}

/// Contents fixed by `key`. A later slot reveals them; this function does not check the slot gap.
pub fn reveal_shell(key: &[u8; 32], shell: u8) -> Result<RevealedShell, LogicError> {
    if usize::from(shell) >= DUST_PPM.len() {
        return Err(LogicError::BadShell);
    }
    if shell == SHELL_CRATER {
        return Ok(two_gems(key, shell)?);
    }
    if ppm_of(word(key, 0)) < DUST_PPM[usize::from(shell)] {
        return Ok(RevealedShell {
            dust_hundredths: DUST_HUNDREDTHS[usize::from(shell)],
            gems: [None, None],
        });
    }
    let second = large_pair(key, shell)?;
    Ok(RevealedShell {
        dust_hundredths: 0,
        gems: [Some(gem_from(key, shell)?), second],
    })
}

fn two_gems(key: &[u8; 32], shell: u8) -> Result<RevealedShell, LogicError> {
    Ok(RevealedShell {
        dust_hundredths: 0,
        gems: [
            Some(gem_from(key, shell)?),
            Some(gem_from(&stretch(key), shell)?),
        ],
    })
}

fn large_pair(key: &[u8; 32], shell: u8) -> Result<Option<Gem>, LogicError> {
    if shell != super::ids::SHELL_LARGE || ppm_of(word(key, 6)) >= PAIR_PPM_LARGE {
        return Ok(None);
    }
    Ok(Some(gem_from(&stretch(key), shell)?))
}

fn gem_from(key: &[u8; 32], shell: u8) -> Result<Gem, LogicError> {
    Ok(Gem {
        tone: tone_of(word(key, 5)),
        grade: grade_of(shell, ppm_of(word(key, 1)))?,
        purity_bp: purity_of(word(key, 2), word(key, 3)),
        pattern: pattern_of(word(key, 4)),
    })
}

fn stretch(key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(key);
    hasher.update([1u8]);
    finish(hasher)
}

fn word(key: &[u8; 32], index: usize) -> u32 {
    let start = index * 4;
    u32::from_le_bytes([key[start], key[start + 1], key[start + 2], key[start + 3]])
}

fn grade_of(shell: u8, roll: u32) -> Result<u8, LogicError> {
    let table = GRADE_PPM
        .get(usize::from(shell))
        .ok_or(LogicError::BadShell)?;
    let mut acc = 0u32;
    for (index, weight) in table.iter().enumerate() {
        acc = acc.saturating_add(*weight);
        if roll < acc {
            return Ok(index as u8);
        }
    }
    Ok(4)
}

fn unit_bp(n: u32) -> u16 {
    ((u64::from(n) * 10_001) / (1u64 << 32)) as u16
}

fn purity_of(a: u32, b: u32) -> u16 {
    let mean = (u32::from(unit_bp(a)) + u32::from(unit_bp(b))) / 2;
    u16::try_from(mean).unwrap_or(10_000)
}

fn pattern_of(n: u32) -> u16 {
    ((u64::from(n) * 1_000) / (1u64 << 32)) as u16
}

fn tone_of(n: u32) -> u8 {
    ((u64::from(n) * 4) / (1u64 << 32)) as u8
}

#[cfg(test)]
mod tests {
    use super::{commitment, reveal_shell, seal_key, thaw_fee};
    use crate::logic::ids::{
        GRADE_DIM, GRADE_GLOWING, SHELL_CRATER, SHELL_LARGE, SHELL_MEDIUM, SHELL_SMALL, TONE_DAWN,
    };

    fn key_words(words: [u32; 8]) -> [u8; 32] {
        let mut key = [0u8; 32];
        for (index, word) in words.iter().enumerate() {
            key[index * 4..index * 4 + 4].copy_from_slice(&word.to_le_bytes());
        }
        key
    }

    #[test]
    fn commitment_is_the_hash_of_the_key() {
        let salt = [9u8; 32];
        let key = seal_key(&salt, 42);
        assert_ne!(key, seal_key(&salt, 43));
        assert_ne!(key, seal_key(&[8u8; 32], 42));
        assert_eq!(commitment(&key), commitment(&key));
    }

    #[test]
    fn a_zero_small_shell_is_dust_and_a_crater_shell_is_two_blocks() {
        let key = [0u8; 32];
        let dust = reveal_shell(&key, SHELL_SMALL).unwrap();
        assert_eq!(dust.dust_hundredths, 200);
        assert_eq!(dust.gems, [None, None]);

        let crater = reveal_shell(&key, SHELL_CRATER).unwrap();
        assert_eq!(crater.dust_hundredths, 0);
        let first = crater.gems[0].unwrap();
        assert_eq!(first.tone, TONE_DAWN);
        assert_eq!(first.grade, GRADE_GLOWING);
        assert_eq!(first.purity_bp, 0);
        assert_eq!(first.pattern, 0);
        assert!(crater.gems[1].is_some());
    }

    #[test]
    fn a_high_first_word_opens_a_dim_block_and_purity_can_reach_one() {
        let mut words = [0u32; 8];
        words[0] = 3_006_477_108;
        words[2] = u32::MAX;
        words[3] = u32::MAX;
        words[6] = 644_245_095;
        let opened = reveal_shell(&key_words(words), SHELL_SMALL).unwrap();
        let gem = opened.gems[0].unwrap();
        assert_eq!(opened.dust_hundredths, 0);
        assert_eq!(gem.grade, GRADE_DIM);
        assert_eq!(gem.purity_bp, 10_000);
        assert!(opened.gems[1].is_none());

        let large = reveal_shell(&key_words(words), SHELL_LARGE).unwrap();
        assert!(large.gems[1].is_none());
        words[6] = 0;
        let paired = reveal_shell(&key_words(words), SHELL_LARGE).unwrap();
        assert!(paired.gems[1].is_some());
    }

    #[test]
    fn unknown_shell_is_rejected() {
        assert!(reveal_shell(&[0u8; 32], 9).is_err());
        assert!(thaw_fee(9).is_err());
    }

    #[test]
    fn thaw_fees_match_the_table_in_hundredths() {
        assert_eq!(thaw_fee(SHELL_SMALL), Ok(500));
        assert_eq!(thaw_fee(SHELL_MEDIUM), Ok(1_200));
        assert_eq!(thaw_fee(SHELL_LARGE), Ok(3_000));
        assert_eq!(thaw_fee(SHELL_CRATER), Ok(0));
    }
}
