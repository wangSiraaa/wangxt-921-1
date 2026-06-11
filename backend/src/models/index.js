const { Sequelize, DataTypes } = require('sequelize')
const path = require('path')
const fs = require('fs')

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'internship.db')
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
})

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('company', 'student', 'teacher'),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100)
  },
  phone: {
    type: DataTypes.STRING(20)
  }
})

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  companyName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  industry: {
    type: DataTypes.STRING(100)
  },
  address: {
    type: DataTypes.STRING(300)
  },
  description: {
    type: DataTypes.TEXT
  }
})

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  studentNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  major: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  grade: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  college: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  hasInsurance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
})

const Teacher = sequelize.define('Teacher', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  teacherNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(50)
  }
})

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Company,
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  requiredMajor: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  requiredGrade: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quota: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  remainingQuota: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false
  },
  requireInsurance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  salary: {
    type: DataTypes.STRING(100)
  },
  location: {
    type: DataTypes.STRING(200)
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'filled'),
    defaultValue: 'open'
  }
})

const Resume = sequelize.define('Resume', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id'
    },
    unique: true
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER
  },
  skills: {
    type: DataTypes.TEXT
  },
  experience: {
    type: DataTypes.TEXT
  },
  education: {
    type: DataTypes.TEXT
  },
  uploadTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
})

const QualificationReview = sequelize.define('QualificationReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id'
    },
    unique: true
  },
  resumeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Resume,
      key: 'id'
    }
  },
  teacherId: {
    type: DataTypes.INTEGER,
    references: {
      model: Teacher,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  comment: {
    type: DataTypes.TEXT
  },
  reviewTime: {
    type: DataTypes.DATE
  }
})

const Application = sequelize.define('Application', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id'
    }
  },
  jobId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Job,
      key: 'id'
    }
  },
  resumeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Resume,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('applied', 'reviewing', 'accepted', 'rejected', 'confirmed', 'disabled'),
    defaultValue: 'applied'
  },
  applyTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  rejectReason: {
    type: DataTypes.STRING(500)
  },
  isHireable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
})

const HiringRecord = sequelize.define('HiringRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  applicationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Application,
      key: 'id'
    },
    unique: true
  },
  jobId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Job,
      key: 'id'
    }
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id'
    }
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Company,
      key: 'id'
    }
  },
  quotaBefore: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quotaAfter: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  hireTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  confirmedTime: {
    type: DataTypes.DATE
  }
})

User.hasOne(Company, { foreignKey: 'userId' })
Company.belongsTo(User, { foreignKey: 'userId' })

User.hasOne(Student, { foreignKey: 'userId' })
Student.belongsTo(User, { foreignKey: 'userId' })

User.hasOne(Teacher, { foreignKey: 'userId' })
Teacher.belongsTo(User, { foreignKey: 'userId' })

Company.hasMany(Job, { foreignKey: 'companyId' })
Job.belongsTo(Company, { foreignKey: 'companyId' })

Student.hasOne(Resume, { foreignKey: 'studentId' })
Resume.belongsTo(Student, { foreignKey: 'studentId' })

Student.hasOne(QualificationReview, { foreignKey: 'studentId' })
QualificationReview.belongsTo(Student, { foreignKey: 'studentId' })
QualificationReview.belongsTo(Resume, { foreignKey: 'resumeId' })
QualificationReview.belongsTo(Teacher, { foreignKey: 'teacherId' })

Student.hasMany(Application, { foreignKey: 'studentId' })
Job.hasMany(Application, { foreignKey: 'jobId' })
Resume.hasMany(Application, { foreignKey: 'resumeId' })
Application.belongsTo(Student, { foreignKey: 'studentId' })
Application.belongsTo(Job, { foreignKey: 'jobId' })
Application.belongsTo(Resume, { foreignKey: 'resumeId' })

Application.hasOne(HiringRecord, { foreignKey: 'applicationId' })
HiringRecord.belongsTo(Application, { foreignKey: 'applicationId' })
HiringRecord.belongsTo(Job, { foreignKey: 'jobId' })
HiringRecord.belongsTo(Student, { foreignKey: 'studentId' })
HiringRecord.belongsTo(Company, { foreignKey: 'companyId' })

const initDB = async () => {
  await sequelize.sync({ force: false })
  return sequelize
}

module.exports = {
  sequelize,
  initDB,
  User,
  Company,
  Student,
  Teacher,
  Job,
  Resume,
  QualificationReview,
  Application,
  HiringRecord
}
