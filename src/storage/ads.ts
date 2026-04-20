export type AdOutcome = 'granted' | 'dismissed' | 'error';

export type AdPlacement = 'hint' | 'retry';

export interface AdProvider {
  showRewardedAd(placement: AdPlacement): Promise<AdOutcome>;
}

const DEV_GRANT_DELAY_MS = 400;

class StubAdProvider implements AdProvider {
  async showRewardedAd(_placement: AdPlacement): Promise<AdOutcome> {
    await new Promise<void>(resolve => setTimeout(resolve, DEV_GRANT_DELAY_MS));
    return 'granted';
  }
}

export const adProvider: AdProvider = new StubAdProvider();
