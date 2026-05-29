import {
  getAppointments,
  saveAppointment,
  deleteAppointment,
  getUpcoming,
  getPast,
  scheduleAppointmentReminder,
  cancelAppointmentReminder,
  type Appointment,
} from '../appointmentService';
import { getItem, setItem } from '../localDB';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockSetItem = setItem as jest.MockedFunction<typeof setItem>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const future = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow
const past = new Date(Date.now() - 86_400_000).toISOString(); // yesterday

const appt1: Appointment = {
  id: 'a1',
  petId: 'p1',
  petName: 'Buddy',
  title: 'Annual checkup',
  date: future,
  status: 'upcoming',
};

const appt2: Appointment = {
  id: 'a2',
  petId: 'p1',
  petName: 'Buddy',
  title: 'Vaccination',
  date: past,
  status: 'completed',
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

describe('getAppointments', () => {
  it('returns empty array when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getAppointments()).toEqual([]);
  });

  it('parses stored JSON', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([appt1]));
    expect(await getAppointments()).toEqual([appt1]);
  });

  it('returns empty array on malformed JSON', async () => {
    mockGetItem.mockResolvedValue('not-json');
    expect(await getAppointments()).toEqual([]);
  });
});

describe('saveAppointment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends a new appointment', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([appt1]));
    await saveAppointment(appt2);
    expect(mockSetItem).toHaveBeenCalledWith('@appointments', JSON.stringify([appt1, appt2]));
  });

  it('updates an existing appointment by id', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([appt1]));
    const updated = { ...appt1, title: 'Updated checkup' };
    await saveAppointment(updated);
    expect(mockSetItem).toHaveBeenCalledWith('@appointments', JSON.stringify([updated]));
  });
});

describe('deleteAppointment', () => {
  it('removes the appointment with the given id', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify([appt1, appt2]));
    await deleteAppointment('a1');
    expect(mockSetItem).toHaveBeenCalledWith('@appointments', JSON.stringify([appt2]));
  });
});

// ─── Derived views ────────────────────────────────────────────────────────────

describe('getUpcoming', () => {
  it('returns only upcoming appointments with future dates', () => {
    const result = getUpcoming([appt1, appt2]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('excludes upcoming appointments with past dates', () => {
    const stale: Appointment = { ...appt1, date: past };
    expect(getUpcoming([stale])).toHaveLength(0);
  });

  it('sorts ascending by date', () => {
    const soon: Appointment = {
      ...appt1,
      id: 'a3',
      date: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const later: Appointment = {
      ...appt1,
      id: 'a4',
      date: new Date(Date.now() + 7_200_000).toISOString(),
    };
    const result = getUpcoming([later, soon]);
    expect(result[0].id).toBe('a3');
  });
});

describe('getPast', () => {
  it('returns completed and cancelled appointments', () => {
    const cancelled: Appointment = { ...appt1, id: 'a5', status: 'cancelled' };
    const result = getPast([appt1, appt2, cancelled]);
    const ids = result.map((a) => a.id);
    expect(ids).toContain('a2');
    expect(ids).toContain('a5');
    expect(ids).not.toContain('a1');
  });

  it('sorts descending by date', () => {
    const older: Appointment = {
      ...appt2,
      id: 'a6',
      date: new Date(Date.now() - 172_800_000).toISOString(),
    };
    const result = getPast([older, appt2]);
    expect(result[0].id).toBe('a2');
  });
});

// ─── Notification helpers ─────────────────────────────────────────────────────

describe('scheduleAppointmentReminder', () => {
  it('returns null for past appointments', async () => {
    const result = await scheduleAppointmentReminder({ ...appt1, date: past });
    expect(result).toBeNull();
  });

  it('schedules and returns a notification id for future appointments', async () => {
    const result = await scheduleAppointmentReminder(appt1);
    expect(result).toBe('notif-id');
  });
});

describe('cancelAppointmentReminder', () => {
  it('calls cancelScheduledNotificationAsync with the given id', async () => {
    await cancelAppointmentReminder('notif-id');
    const N = jest.requireMock('expo-notifications') as typeof import('expo-notifications');
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id');
  });
});
