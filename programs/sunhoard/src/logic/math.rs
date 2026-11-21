pub(crate) fn isqrt(n: i64) -> i64 {
    if n <= 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

#[cfg(test)]
mod tests {
    use super::isqrt;

    #[test]
    fn squares_and_the_gap_below() {
        assert_eq!(isqrt(0), 0);
        assert_eq!(isqrt(1), 1);
        assert_eq!(isqrt(24 * 24), 24);
        assert_eq!(isqrt(25), 5);
        assert_eq!(isqrt(26), 5);
    }
}
