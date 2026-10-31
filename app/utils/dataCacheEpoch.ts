let epoch = 0
export const currentDataCacheEpoch = () => epoch
export const invalidateDataCacheEpoch = () => ++epoch
