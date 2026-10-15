import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';
import VolumeControl from './VolumeControl';

export default function PlayerControls() {
  const isPaused = usePlayerState((state) => state.isPaused);
  const { t } = useLingui();

  return (
    <div {...stylex.props(styles.playerControls)}>
      <ButtonIcon
        icon="skipBack"
        iconSize={16}
        label={t`Previous`}
        onClick={() => player.previous()}
      />
      <ButtonIcon
        icon={isPaused ? 'play' : 'pause'}
        iconSize={28}
        xstyle={styles.playButton}
        label={isPaused ? t`Play` : t`Pause`}
        onClick={() => player.playPause()}
      />
      <ButtonIcon
        icon="skipForward"
        iconSize={16}
        label={t`Next`}
        onClick={() => player.next()}
      />
      <VolumeControl />
    </div>
  );
}

const styles = stylex.create({
  playButton: {
    backgroundColor: 'var(--main-color)',
    color: 'var(--on-main-color)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    boxShadow:
      '0 0 18px color-mix(in srgb, var(--main-color) 20%, transparent)',
  },
  playerControls: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    rowGap: '12px',
    columnGap: '12px',
  },
});
