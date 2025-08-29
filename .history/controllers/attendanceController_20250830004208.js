const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const moment = require("moment-timezone");

const TIMEZONE = "Asia/Kolkata"; // set default timezone

// POST /api/attendance/mark-in
exports.markIn = async (req, res) => {
  const employeeId = req.user.id;
  const date = moment().tz(TIMEZONE).format("YYYY-MM-DD");   // ✅ local date
  const loginTime = moment().tz(TIMEZONE).format("HH:mm:ss"); // ✅ local time

  try {
    const existing = await Attendance.findOne({ employee: employeeId, date });
    if (existing) {
      return res.status(200).json({ msg: "Already marked in." });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ msg: "Employee not found" });
    }

    const attendance = new Attendance({
      employee: employeeId,
      name: employee.name,
      email: employee.email,
      date,
      loginTime,
    });

    await attendance.save();
    res.status(201).json({ msg: "Login time recorded", attendance });
  } catch (err) {
    console.error("Error saving attendance:", err);
    res.status(500).json({ error: err.message });
  }
};


// POST /api/attendance/mark-out

exports.markOut = async (req, res) => {
  const TIMEZONE = "Asia/Kolkata";
  const employeeId = req.user.id;

  // Use IST for date + time
  const date = moment().tz(TIMEZONE).format("YYYY-MM-DD");
  const logoutTime = moment().tz(TIMEZONE);

  try {
    const attendance = await Attendance.findOne({ employee: employeeId, date });

    if (!attendance) {
      return res.status(404).json({ msg: "No attendance record found for today" });
    }

    if (attendance.logoutTime) {
      return res.status(200).json({ msg: "Already marked out" });
    }

    // 🔹 Parse stored login time with IST
    const loginTime = moment.tz(
      `${date} ${attendance.loginTime}`,
      "YYYY-MM-DD HH:mm:ss",
      TIMEZONE
    );

    // 🔹 Duration in IST
    const duration = moment.duration(logoutTime.diff(loginTime));
    const hoursWorked = duration.asHours();

    // 🔹 Format as HH:MM hrs
    const totalMinutes = Math.floor(duration.asMinutes());
    const displayHours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const displayMinutes = String(totalMinutes % 60).padStart(2, "0");
    const formattedWorked = `${displayHours}:${displayMinutes} hrs`;

    // Status logic
    let status = "Absent";
    if (hoursWorked >= 7.5) {
      status = "Present";
    } else if (hoursWorked >= 4) {
      status = "Half Day";
    }

    // Save back in IST
    attendance.logoutTime = logoutTime.format("HH:mm:ss");
    attendance.hoursWorked = hoursWorked.toFixed(2);       // numeric for reports
    attendance.hoursWorkedFormatted = formattedWorked;     // user-friendly
    attendance.status = status;

    await attendance.save();

    res.status(200).json({
      msg: "Logout time recorded",
      attendance,
      status,
      hoursWorked: hoursWorked.toFixed(2),
      hoursWorkedFormatted: formattedWorked,
    });
  } catch (err) {
    console.error("Error marking out:", err);
    res.status(500).json({ error: err.message });
  }
};




// GET /api/attendance/all (Admin only)
exports.getAll = async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find({ role: { $ne: "admin" } }).sort({ date: -1 });
    res.status(200).json(attendanceRecords);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      employee: req.user.id,
      role: { $ne: "admin" } // exclude admin
    }).sort({ date: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching your attendance", error });
  }
};