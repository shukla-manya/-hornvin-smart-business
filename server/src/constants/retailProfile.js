/** Garage (retail) business type — stored on `User.businessType`. */
export const RETAIL_BUSINESS_TYPES = ["independent", "authorized_dealer", "franchise", "multi_brand", "other"];

export const RETAIL_BUSINESS_TYPES_SET = new Set(RETAIL_BUSINESS_TYPES);

/** Max stored length for profile / shop photos (data URL or https). */
export const RETAIL_PHOTO_MAX_LEN = 500_000;
