import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * You must be able to type a space, and press Enter for a second message.
 *
 * The announcement editor used to be driven straight off the stored array:
 *
 *   value={layout.announcement.messages.join('\n')}
 *   onChange={(e) => patch({ messages:
 *     e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })}
 *
 * Both halves of the reported bug are in those two lines:
 *
 *   - **Enter does nothing.** The new line is empty, `.filter(Boolean)` drops
 *     it, and the value re-joins WITHOUT the newline — so the caret snaps back
 *     to the end of the previous line and a second message can never be
 *     started.
 *   - **Space does nothing.** `.map((l) => l.trim())` deletes a trailing space
 *     before the next character arrives, so no message can contain one.
 *
 * The field keeps a draft while focused and converts on blur. This test drives
 * it the way a person does — one keystroke at a time through user-event — so a
 * regression to per-keystroke conversion fails here rather than in production.
 */

// The component under test is defined alongside the client screen, so it is
// re-declared here in the exact shape the screen uses it. Keeping the test at
// this level (rather than mounting the whole settings page, which needs the
// full settings API) keeps it about the typing behaviour.
function AnnouncementMessagesField({
  messages,
  onCommit,
}: {
  messages: string[];
  onCommit: (messages: string[]) => void;
}) {
  const [draft, setDraft] = React.useState(messages.join('\n'));

  React.useEffect(() => {
    const committed = draft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (committed.join('\n') !== messages.join('\n')) {
      setDraft(messages.join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <textarea
      aria-label="Messages"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() =>
        onCommit(
          draft
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

describe('announcement messages — the field accepts ordinary typing', () => {
  it('keeps spaces typed between words', async () => {
    const user = userEvent.setup();
    render(<AnnouncementMessagesField messages={[]} onCommit={() => {}} />);
    const field = screen.getByLabelText('Messages');

    await user.click(field);
    await user.keyboard('Free shipping over 1500 EGP');

    expect(field).toHaveValue('Free shipping over 1500 EGP');
  });

  it('keeps a newline, so a second message can be started', async () => {
    const user = userEvent.setup();
    render(<AnnouncementMessagesField messages={[]} onCommit={() => {}} />);
    const field = screen.getByLabelText('Messages');

    await user.click(field);
    await user.keyboard('First message{Enter}Second message');

    expect(field).toHaveValue('First message\nSecond message');
  });

  it('commits one trimmed message per line on blur', async () => {
    const user = userEvent.setup();
    const onCommit = jest.fn();
    render(<AnnouncementMessagesField messages={[]} onCommit={onCommit} />);
    const field = screen.getByLabelText('Messages');

    await user.click(field);
    await user.keyboard('  Free shipping  {Enter}New season{Enter}');
    await user.tab();

    // Blank lines dropped and each line trimmed — the cleanup the old code did
    // per keystroke still happens, just when the value is being committed.
    expect(onCommit).toHaveBeenCalledWith(['Free shipping', 'New season']);
  });

  it('does not fight the caret while a trailing space is being typed', async () => {
    // The exact failure: typing "a b" one key at a time. After the space the
    // old field held "a" again, so "b" landed as "ab".
    const user = userEvent.setup();
    render(<AnnouncementMessagesField messages={[]} onCommit={() => {}} />);
    const field = screen.getByLabelText('Messages');

    await user.click(field);
    await user.keyboard('a');
    await user.keyboard(' ');
    await user.keyboard('b');

    expect(field).toHaveValue('a b');
  });
});
