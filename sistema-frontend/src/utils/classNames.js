export function classNames(...values) {
  return values
    .flatMap((value) =>
      typeof value === 'string'
        ? value.trim()
        : Array.isArray(value)
        ? classNames(...value)
        : typeof value === 'object' && value !== null
        ? Object.entries(value)
            .filter(([, condition]) => Boolean(condition))
            .map(([key]) => key)
        : ''
    )
    .filter(Boolean)
    .join(' ');
}
