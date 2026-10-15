import {
  Award,
  BrainCircuit,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  IdCard,
  ListTodo,
  Plus,
  Save,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import type { Department, Employee, HrTask, LeaveRequest, ShiftRow, ShiftType, TrainingRecord } from '@/shared/services/operations'
import {
  BRANCHES,
  DEPARTMENTS,
  SHIFT_TIMES,
  WEEK_DAYS,
  getEmployees,
  getHrTasks,
  getLeaveRequests,
  getShiftSchedule,
  getTrainings,
  saveEmployee,
  saveShiftSchedule,
  staffingForecast,
  updateLeaveRequest,
} from '@/shared/services/operations'

type TabId = 'profiles' | 'shifts' | 'payroll' | 'tasks' | 'performance' | 'ai'

const shiftStyle: Record<ShiftType, string> = {
  Morning: 'bg-sky-100 text-sky-800',
  Evening: 'bg-brand-100 text-brand-800',
  Night: 'bg-indigo-100 text-indigo-800',
  Split: 'bg-teal-100 text-teal-800',
  Off: 'bg-slate-50 text-slate-400',
  Leave: 'bg-violet-100 text-violet-700',
}
const CYCLE: ShiftType[] = ['Morning', 'Evening', 'Night', 'Split', 'Off']

const otRate = (e: Employee) => (e.salary / 208) * 1.5
const payroll = (e: Employee) => {
  const ot = e.overtimeHrs * otRate(e)
  const allowance = e.department === 'Delivery' ? 60 : 25
  const gross = e.salary + ot + allowance
  const tax = gross > 1500 ? gross * 0.05 : 0
  const eobi = 6
  return { ot, allowance, gross, deductions: tax + eobi, net: gross - tax - eobi }
}

export default function Employees() {
  const notify = useToast()
  const { branch } = useAuth()
  const empQ = useAsync(getEmployees)
  const shiftQ = useAsync(getShiftSchedule)
  const leaveQ = useAsync(getLeaveRequests)
  const taskQ = useAsync(getHrTasks)
  const trainQ = useAsync(getTrainings)
  const [tab, setTab] = useState<TabId>('profiles')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [adding, setAdding] = useState(false)

  const all = empQ.data ?? []
  const employees = all.filter((e) => branch === 'All branches' || e.branch === branch)

  const patchEmp = (id: string, p: Partial<Employee>) => {
    empQ.setData((prev) => (prev ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)))
    setSelected((s) => (s?.id === id ? { ...s, ...p } : s))
  }

  if (empQ.loading) return <LoadingState label="Loading staff…" />

  const present = employees.filter((e) => e.attendance === 'Present' || e.attendance === 'Late').length
  const scheduled = employees.filter((e) => e.attendance !== 'Off' && e.attendance !== 'On leave').length
  const payrollTotal = employees.reduce((s, e) => s + payroll(e).net, 0)
  const otHours = employees.reduce((s, e) => s + e.overtimeHrs, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Employees & HR"
        description={`Profiles, shifts, payroll, tasks & training · ${branch}`}
        actions={
          <>
            <Button variant="outline" icon={Wallet} onClick={() => setTab('payroll')}>
              Payroll
            </Button>
            <Button icon={UserPlus} onClick={() => setAdding(true)}>
              Add employee
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Headcount" value={employees.length} icon={Users} tone="brand" hint={`${employees.filter((e) => e.status === 'On leave').length} on leave`} />
        <StatCard label="Present today" value={`${present}/${scheduled}`} icon={UserCheck} tone="green" hint={`${employees.filter((e) => e.attendance === 'Late').length} late · ${employees.filter((e) => e.attendance === 'Absent').length} absent`} />
        <StatCard label="Payroll (this month)" value={formatCurrency(payrollTotal, { compact: true })} icon={Wallet} tone="purple" delta={3.1} invertDelta deltaLabel="vs last month" />
        <StatCard label="Overtime hours" value={otHours} icon={Clock} tone="amber" hint={formatCurrency(employees.reduce((s, e) => s + payroll(e).ot, 0))} />
      </div>

      <Tabs
        items={[
          { id: 'profiles', label: 'Profiles & roles', icon: IdCard, count: employees.length },
          { id: 'shifts', label: 'Attendance & shifts', icon: CalendarDays },
          { id: 'payroll', label: 'Payroll, leave & overtime', icon: Wallet, count: (leaveQ.data ?? []).filter((l) => l.status === 'Pending').length },
          { id: 'tasks', label: 'Departments & tasks', icon: ListTodo },
          { id: 'performance', label: 'Performance & training', icon: Award },
          { id: 'ai', label: 'AI workforce', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profiles' && <ProfilesTab employees={employees} onOpen={setSelected} />}
      {tab === 'shifts' && (
        <ShiftsTab
          employees={employees}
          rows={shiftQ.data ?? []}
          setRows={(rows) => shiftQ.setData(rows)}
          onMark={(e, a) => {
            patchEmp(e.id, { attendance: a, checkIn: a === 'Present' ? new Date().toTimeString().slice(0, 5) : e.checkIn })
            notify(`${e.name} marked ${a.toLowerCase()}`)
          }}
        />
      )}
      {tab === 'payroll' && (
        <PayrollTab
          employees={employees}
          leaves={leaveQ.data ?? []}
          onLeave={async (l, status) => {
            await updateLeaveRequest({ ...l, status })
            leaveQ.setData((prev) => (prev ?? []).map((x) => (x.id === l.id ? { ...x, status } : x)))
            notify(`Leave for ${l.employee} ${status.toLowerCase()}`, status === 'Approved' ? 'success' : 'info')
          }}
        />
      )}
      {tab === 'tasks' && <TasksTab employees={employees} tasks={taskQ.data ?? []} setTasks={(fn) => taskQ.setData((prev) => fn(prev ?? []))} />}
      {tab === 'performance' && <PerformanceTab employees={employees} trainings={trainQ.data ?? []} onAssign={(t) => (trainQ.setData((prev) => [t, ...(prev ?? [])]), notify(`${t.course} assigned to ${t.employee}`))} />}
      {tab === 'ai' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card
            title="AI workforce forecast"
            subtitle="Scheduled vs recommended staff per day, with forecast covers"
            className="xl:col-span-2"
            actions={
              <Button
                variant="ai"
                size="sm"
                icon={Sparkles}
                onClick={() => {
                  shiftQ.setData((prev) =>
                    (prev ?? []).map((r) => {
                      const e = all.find((x) => x.id === r.employeeId)
                      if (!e || !['Service', 'Kitchen'].includes(e.department)) return r
                      return { ...r, shifts: r.shifts.map((s, d) => (d >= 4 && s === 'Off' ? 'Evening' : s)) }
                    }),
                  )
                  notify('Smart schedule applied: weekend evening gaps filled', 'success')
                  setTab('shifts')
                }}
              >
                Apply smart schedule
              </Button>
            }
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={staffingForecast} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="day" {...chartAxis} />
                  <YAxis yAxisId="s" {...chartAxis} />
                  <YAxis yAxisId="c" orientation="right" {...chartAxis} />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="s" dataKey="scheduled" name="Scheduled staff" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="s" dataKey="recommended" name="AI recommended" fill={chartColors[6]} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="c" dataKey="covers" name="Forecast covers" stroke={chartColors[0]} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <AIPanel module="employees" title="AI workforce & smart scheduling" subtitle="Demand-based staffing, overtime & attrition signals" />
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name} description={selected ? `${selected.code} · ${selected.role}` : ''}>
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selected.name} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-900">{selected.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.attendance} />
                  <Badge tone="blue">{selected.department}</Badge>
                </div>
              </div>
            </div>
            <DescriptionList
              items={[
                { label: 'Phone', value: selected.phone },
                { label: 'Email', value: selected.email },
                { label: 'Branch', value: selected.branch },
                { label: 'Joined', value: formatDate(selected.joinedAt) },
                { label: 'Monthly salary', value: formatCurrency(selected.salary) },
                { label: 'Leave balance', value: `${selected.leaveBalance} days` },
                { label: 'Overtime (period)', value: `${selected.overtimeHrs} h` },
                { label: 'Check-in today', value: selected.checkIn ?? '—' },
              ]}
            />
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-800">Performance score</p>
              <ProgressBar value={selected.performance} tone={selected.performance >= 90 ? 'green' : selected.performance >= 80 ? 'blue' : 'yellow'} showLabel />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role">
                <Input value={selected.role} onChange={(e) => patchEmp(selected.id, { role: e.target.value })} />
              </Field>
              <Field label="Department">
                <Select value={selected.department} onChange={(e) => patchEmp(selected.id, { department: e.target.value as Department })} options={[...DEPARTMENTS]} />
              </Field>
              <Field label="Status">
                <Select value={selected.status} onChange={(e) => patchEmp(selected.id, { status: e.target.value as Employee['status'] })} options={['Active', 'On leave', 'Inactive']} />
              </Field>
              <Field label="Branch">
                <Select value={selected.branch} onChange={(e) => patchEmp(selected.id, { branch: e.target.value as Employee['branch'] })} options={[...BRANCHES]} />
              </Field>
            </div>
            <Button
              block
              icon={Save}
              onClick={async () => {
                await saveEmployee(selected)
                notify(`${selected.name}'s profile saved`)
                setSelected(null)
              }}
            >
              Save profile
            </Button>
          </div>
        )}
      </Drawer>

      <AddEmployeeModal
        open={adding}
        defaultBranch={branch === 'All branches' ? 'Downtown' : (branch as Employee['branch'])}
        nextNo={all.length + 1}
        onClose={() => setAdding(false)}
        onSave={async (e) => {
          await saveEmployee(e)
          empQ.setData((prev) => [...(prev ?? []), e])
          shiftQ.setData((prev) => [...(prev ?? []), { employeeId: e.id, shifts: ['Morning', 'Morning', 'Morning', 'Morning', 'Morning', 'Off', 'Off'] }])
          setAdding(false)
          notify(`${e.name} added · onboarding checklist sent`)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ProfilesTab({ employees, onOpen }: { employees: Employee[]; onOpen: (e: Employee) => void }) {
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const rows = employees.filter((e) => (!dept || e.department === dept) && (!status || e.status === status))
  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      render: (e) => (
        <div className="flex items-center gap-3">
          <Avatar name={e.name} />
          <div>
            <p className="font-medium text-slate-900">{e.name}</p>
            <p className="text-xs text-slate-500">{e.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'department', header: 'Department', render: (e) => <Badge tone="blue">{e.department}</Badge> },
    { key: 'branch', header: 'Branch' },
    { key: 'phone', header: 'Phone', render: (e) => <span className="text-slate-500">{e.phone}</span> },
    { key: 'joinedAt', header: 'Joined', sortable: true, render: (e) => <span className="text-slate-500">{formatDate(e.joinedAt)}</span> },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ]
  return (
    <Card flush>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(e) => e.id}
        searchKeys={['name', 'role', 'code', 'phone']}
        searchPlaceholder="Search name, role, code…"
        onRowClick={onOpen}
        pageSize={10}
        toolbar={
          <>
            <Select value={dept} onChange={(e) => setDept(e.target.value)} options={[...DEPARTMENTS]} placeholder="All departments" className="h-9 w-40" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['Active', 'On leave', 'Inactive']} placeholder="All statuses" className="h-9 w-32" />
          </>
        }
      />
    </Card>
  )
}

function ShiftsTab({
  employees,
  rows,
  setRows,
  onMark,
}: {
  employees: Employee[]
  rows: ShiftRow[]
  setRows: (r: ShiftRow[]) => void
  onMark: (e: Employee, a: Employee['attendance']) => void
}) {
  const notify = useToast()
  const [saving, setSaving] = useState(false)
  const visible = employees.map((e) => ({ e, row: rows.find((r) => r.employeeId === e.id) })).filter((x): x is { e: Employee; row: ShiftRow } => !!x.row)
  const cycle = (id: string, d: number) =>
    setRows(rows.map((r) => (r.employeeId !== id ? r : { ...r, shifts: r.shifts.map((s, i) => (i !== d || s === 'Leave' ? s : CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length]!)) })))
  const coverage = WEEK_DAYS.map((_, d) => visible.filter((x) => !['Off', 'Leave'].includes(x.row.shifts[d]!)).length)
  const counts = (a: Employee['attendance']) => employees.filter((e) => e.attendance === a).length
  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['Present', 'Late', 'Absent', 'On leave', 'Off'] as const).map((a) => (
          <div key={a} className="rounded-xl border border-slate-200 bg-white p-3">
            <StatusBadge status={a} />
            <p className="mt-1 text-2xl font-semibold text-slate-900">{counts(a)}</p>
          </div>
        ))}
      </div>

      <Card
        title="Weekly shift schedule"
        subtitle="Click a cell to cycle Morning → Evening → Night → Split → Off"
        flush
        actions={
          <Button
            size="sm"
            icon={Save}
            loading={saving}
            onClick={async () => {
              setSaving(true)
              await saveShiftSchedule(rows)
              setSaving(false)
              notify('Schedule published · staff notified via app & SMS')
            }}
          >
            Publish schedule
          </Button>
        }
      >
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold text-slate-500 uppercase">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left">Employee</th>
                {WEEK_DAYS.map((d, i) => (
                  <th key={d} className={cn('px-2 py-2.5 text-center', i === todayIdx && 'text-brand-600')}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(({ e, row }) => (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{e.name}</p>
                        <p className="truncate text-xs text-slate-500">{e.role}</p>
                      </div>
                    </div>
                  </td>
                  {row.shifts.map((s, d) => (
                    <td key={d} className="px-1 py-1.5">
                      <button
                        type="button"
                        title={SHIFT_TIMES[s]}
                        onClick={() => cycle(e.id, d)}
                        className={cn('h-9 w-full rounded-md text-xs font-semibold transition hover:ring-2 hover:ring-brand-300', shiftStyle[s], d === todayIdx && 'ring-1 ring-brand-300')}
                      >
                        {s}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-slate-700">Staff on duty</td>
                {coverage.map((c, i) => (
                  <td key={i} className="px-2 py-2 text-center text-slate-800">
                    {c}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          {(Object.keys(SHIFT_TIMES) as ShiftType[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn('h-3 w-5 rounded', shiftStyle[s])} />
              {s} {SHIFT_TIMES[s] !== '—' && <span className="text-slate-400">{SHIFT_TIMES[s]}</span>}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Today's attendance" subtitle="Biometric & app check-ins" flush>
        <ul className="divide-y divide-slate-100">
          {employees.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <Avatar name={e.name} size="sm" />
              <span className="min-w-36 flex-1">
                <span className="font-medium text-slate-800">{e.name}</span> <span className="text-xs text-slate-500">· {e.role}</span>
              </span>
              <span className="w-24 text-xs text-slate-500">{e.checkIn ? `In ${e.checkIn}` : '—'}</span>
              <StatusBadge status={e.attendance} />
              {(e.attendance === 'Absent' || e.attendance === 'Late') && (
                <Button size="xs" variant="outline" onClick={() => onMark(e, 'Present')}>
                  Mark present
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PayrollTab({ employees, leaves, onLeave }: { employees: Employee[]; leaves: LeaveRequest[]; onLeave: (l: LeaveRequest, s: LeaveRequest['status']) => void }) {
  const notify = useToast()
  const [running, setRunning] = useState(false)
  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Employee', render: (e) => <span className="font-medium text-slate-800">{e.name}</span> },
    { key: 'department', header: 'Dept' },
    { key: 'salary', header: 'Base', align: 'right', sortable: true, render: (e) => formatCurrency(e.salary) },
    { key: 'overtimeHrs', header: 'OT hrs', align: 'right', sortable: true, render: (e) => <span className={cn(e.overtimeHrs > 10 && 'font-semibold text-red-600')}>{e.overtimeHrs}</span> },
    { key: 'ot', header: 'OT pay', align: 'right', render: (e) => formatCurrency(payroll(e).ot) },
    { key: 'allow', header: 'Allowances', align: 'right', render: (e) => formatCurrency(payroll(e).allowance) },
    { key: 'ded', header: 'Deductions', align: 'right', render: (e) => <span className="text-red-600">−{formatCurrency(payroll(e).deductions)}</span> },
    { key: 'net', header: 'Net pay', align: 'right', sortable: true, sortValue: (e) => payroll(e).net, render: (e) => <span className="font-semibold text-slate-900">{formatCurrency(payroll(e).net)}</span> },
    { key: 'leaveBalance', header: 'Leave bal.', align: 'right', render: (e) => `${e.leaveBalance}d` },
  ]
  const total = employees.reduce((s, e) => s + payroll(e).net, 0)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card
        title="Payroll — October 2026"
        subtitle={`Net payable ${formatCurrency(total)} · OT at 1.5× hourly rate`}
        flush
        actions={
          <Button
            size="sm"
            icon={Wallet}
            loading={running}
            onClick={async () => {
              setRunning(true)
              await new Promise((r) => setTimeout(r, 700))
              setRunning(false)
              notify(`Payroll processed: ${employees.length} payslips · ${formatCurrency(total)} sent to bank`)
            }}
          >
            Run payroll
          </Button>
        }
      >
        <DataTable columns={columns} data={employees} rowKey={(e) => e.id} searchKeys={['name', 'department']} pageSize={10} />
      </Card>
      <Card title="Leave requests" subtitle={`${leaves.filter((l) => l.status === 'Pending').length} awaiting approval`} flush>
        <ul className="divide-y divide-slate-100">
          {leaves.map((l) => (
            <li key={l.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{l.employee}</p>
                  <p className="text-xs text-slate-500">
                    {l.type} · {l.days} day{l.days > 1 ? 's' : ''} · {formatDate(l.from)}
                    {l.days > 1 ? ` – ${formatDate(l.to)}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 italic">“{l.reason}”</p>
                </div>
                {l.status === 'Pending' ? (
                  <div className="flex gap-1">
                    <button type="button" aria-label="Approve" onClick={() => onLeave(l, 'Approved')} className="rounded-md bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100">
                      <Check size={15} />
                    </button>
                    <button type="button" aria-label="Reject" onClick={() => onLeave(l, 'Rejected')} className="rounded-md bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <StatusBadge status={l.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const TASK_COLS: HrTask['status'][] = ['Open', 'In progress', 'Completed']

function TasksTab({ employees, tasks, setTasks }: { employees: Employee[]; tasks: HrTask[]; setTasks: (fn: (t: HrTask[]) => HrTask[]) => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', assignee: '', priority: 'Medium' as HrTask['priority'] })
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {DEPARTMENTS.map((d) => {
          const list = employees.filter((e) => e.department === d)
          const on = list.filter((e) => ['Present', 'Late'].includes(e.attendance)).length
          return (
            <Card key={d} bodyClassName="p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Briefcase size={14} className="text-slate-400" /> {d}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{list.length}</p>
              <p className="text-xs text-slate-500">
                {on} on shift · {formatCurrency(list.reduce((s, e) => s + e.salary, 0), { compact: true })}/mo
              </p>
              <div className="mt-2 flex -space-x-1.5">
                {list.slice(0, 5).map((e) => (
                  <Avatar key={e.id} name={e.name} size="sm" className="ring-2 ring-white" />
                ))}
              </div>
            </Card>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Task board</h3>
        <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
          Assign task
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TASK_COLS.map((c) => {
          const list = tasks.filter((t) => t.status === c)
          return (
            <div key={c} className="rounded-xl bg-slate-100/70 p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <StatusBadge status={c} />
                <span className="text-xs font-semibold text-slate-500">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className={cn('text-sm font-medium text-slate-800', c === 'Completed' && 'text-slate-400 line-through')}>{t.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <Avatar name={t.assignee} size="sm" />
                      <span>{t.assignee}</span>
                      <Badge tone={t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'yellow' : 'gray'}>{t.priority}</Badge>
                      <Badge>{t.department}</Badge>
                    </div>
                    {c !== 'Completed' && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mt-2 -ml-2"
                        onClick={() => {
                          const next = TASK_COLS[TASK_COLS.indexOf(c) + 1]!
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
                          if (next === 'Completed') notify(`“${t.title}” completed`)
                        }}
                      >
                        {c === 'Open' ? 'Start →' : 'Complete ✓'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Assign task"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!f.title || !f.assignee}
              onClick={() => {
                const emp = employees.find((e) => e.name === f.assignee)
                setTasks((prev) => [{ id: `tk-${Date.now()}`, title: f.title, assignee: f.assignee, department: emp?.department ?? 'Service', due: new Date().toISOString(), priority: f.priority, status: 'Open' }, ...prev])
                setOpen(false)
                setF({ title: '', assignee: '', priority: 'Medium' })
                notify(`Task assigned to ${f.assignee}`)
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Task" required>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Restock bar fridge" />
          </Field>
          <Field label="Assignee" required>
            <Select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} placeholder="Choose employee…" options={employees.map((e) => ({ value: e.name, label: `${e.name} · ${e.department}` }))} />
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as HrTask['priority'] })} options={['Low', 'Medium', 'High']} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PerformanceTab({ employees, trainings, onAssign }: { employees: Employee[]; trainings: TrainingRecord[]; onAssign: (t: TrainingRecord) => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ employee: '', course: 'Food Safety Level 2 (HACCP)', mandatory: true })
  const top = [...employees].sort((a, b) => b.performance - a.performance).slice(0, 10).map((e) => ({ name: e.name.split(' ')[0], score: e.performance }))
  const columns: Column<TrainingRecord>[] = [
    { key: 'employee', header: 'Employee', render: (t) => <span className="flex items-center gap-2"><Avatar name={t.employee} size="sm" />{t.employee}</span> },
    { key: 'course', header: 'Course', render: (t) => <span className="font-medium text-slate-800">{t.course}</span> },
    { key: 'mandatory', header: 'Type', render: (t) => (t.mandatory ? <Badge tone="red">Mandatory</Badge> : <Badge>Optional</Badge>) },
    { key: 'progress', header: 'Progress', sortable: true, render: (t) => <ProgressBar value={t.progress} tone={t.progress === 100 ? 'green' : t.progress < 30 ? 'yellow' : 'blue'} showLabel className="w-36" /> },
    { key: 'due', header: 'Due', sortable: true, render: (t) => <span className={cn('text-xs', t.progress < 100 && new Date(t.due).getTime() - Date.now() < 4 * 86_400_000 ? 'font-semibold text-red-600' : 'text-slate-500')}>{formatDate(t.due)}</span> },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Performance leaderboard" subtitle="Composite score: attendance, speed, guest feedback, upsell" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="name" {...chartAxis} />
                <YAxis domain={[60, 100]} {...chartAxis} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="score" name="Score" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Needs attention" flush>
          <ul className="divide-y divide-slate-100">
            {[...employees]
              .sort((a, b) => a.performance - b.performance)
              .slice(0, 5)
              .map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Avatar name={e.name} size="sm" />
                  <span className="flex-1">
                    {e.name}
                    <span className="block text-xs text-slate-500">{e.role}</span>
                  </span>
                  <span className={cn('font-semibold', e.performance < 80 ? 'text-red-600' : 'text-amber-600')}>{e.performance}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
      <Card title="Training & certifications" flush actions={<Button size="sm" icon={GraduationCap} onClick={() => setOpen(true)}>Assign course</Button>}>
        <DataTable columns={columns} data={trainings} rowKey={(t) => t.id} searchKeys={['employee', 'course']} />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Assign training"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!f.employee}
              onClick={() => {
                onAssign({ id: `tr-${Date.now()}`, employee: f.employee, course: f.course, mandatory: f.mandatory, progress: 0, due: new Date(Date.now() + 14 * 86_400_000).toISOString() })
                setOpen(false)
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Employee" required>
            <Select value={f.employee} onChange={(e) => setF({ ...f, employee: e.target.value })} placeholder="Choose employee…" options={employees.map((e) => e.name)} />
          </Field>
          <Field label="Course">
            <Select
              value={f.course}
              onChange={(e) => setF({ ...f, course: e.target.value })}
              options={['Food Safety Level 2 (HACCP)', 'Upselling & Menu Knowledge', 'POS Refunds & Fraud Prevention', 'Defensive Riding & Road Safety', 'Allergen Awareness', 'Guest Complaint Handling']}
            />
          </Field>
          <Field label="Type">
            <Select value={f.mandatory ? 'Mandatory' : 'Optional'} onChange={(e) => setF({ ...f, mandatory: e.target.value === 'Mandatory' })} options={['Mandatory', 'Optional']} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AddEmployeeModal({
  open,
  defaultBranch,
  nextNo,
  onClose,
  onSave,
}: {
  open: boolean
  defaultBranch: Employee['branch']
  nextNo: number
  onClose: () => void
  onSave: (e: Employee) => void
}) {
  const [f, setF] = useState({ name: '', role: '', department: 'Service' as Department, branch: defaultBranch, phone: '', salary: 600 })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add employee"
      description="Creates the profile, POS PIN and app login."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!f.name || !f.role}
            onClick={() => {
              onSave({
                id: `em-${Date.now()}`,
                code: `SRK-${100 + nextNo}`,
                name: f.name,
                role: f.role,
                department: f.department,
                branch: f.branch,
                phone: f.phone || '—',
                email: `${f.name.split(' ')[0]!.toLowerCase()}@spiceroute.com`,
                status: 'Active',
                joinedAt: new Date().toISOString(),
                salary: f.salary,
                attendance: 'Off',
                overtimeHrs: 0,
                leaveBalance: 14,
                performance: 80,
                skills: [],
              })
              setF({ ...f, name: '', role: '', phone: '' })
            }}
          >
            Add employee
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Role / title" required>
          <Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Waiter, Line Cook…" />
        </Field>
        <Field label="Department">
          <Select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value as Department })} options={[...DEPARTMENTS]} />
        </Field>
        <Field label="Branch">
          <Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value as Employee['branch'] })} options={[...BRANCHES]} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" />
        </Field>
        <Field label="Monthly salary ($)">
          <Input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  )
}
