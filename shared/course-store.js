/* Shared course store
   This file keeps the published course data, sample seed data, and helper methods
   used by both the admin side and the learner side. */
(function () {
    const PUBLISHED_KEY = 'simpPublishedCourses';
    const DRAFT_KEY = 'simpCourseEditorDraft';
    const STORE_UPDATED_EVENT = 'simp-course-store-updated';
    const EDITOR_DRAFT_SCHEMA_VERSION = 2;
    const MAX_INLINE_MEDIA_STORAGE_LENGTH = 900000;
    const LEGACY_SEED_IDS = [
        'computer-course',
        'networking-course',
        'cctv-installation-course',
        'web-development-course',
        'mobile-app-development',
        'data-science-fundamentals',
        'cybersecurity-basics'
    ];
    const CURRENT_SEED_IDS = [
        'networking-support-infrastructure',
        'computer-hardware-it-support',
        'cybersecurity-operations-fundamentals',
        'linux-system-administration',
        'cloud-support-microsoft-365'
    ];

    function lessonSpec(title, subtitle, summary, points) {
        return { title, subtitle, summary, points };
    }

    function levelSpec(title, description, price, lessons) {
        return { title, description, price, lessons };
    }

    function formatSlidesLabel(count) {
        return `${count} slide${count === 1 ? '' : 's'}`;
    }

    function countLessonSlides(lesson) {
        if (!lesson) {
            return 0;
        }

        if (typeof lesson.slideCount === 'number' && lesson.slideCount > 0) {
            return lesson.slideCount;
        }

        if (Array.isArray(lesson.slides)) {
            return lesson.slides.length;
        }

        return 0;
    }

    function countCourseSlides(course) {
        return (course.levels || []).reduce((courseTotal, level) => {
            return courseTotal + (level.lessons || []).reduce((levelTotal, lesson) => levelTotal + countLessonSlides(lesson), 0);
        }, 0);
    }

    function createLessonSlides(lesson) {
        const points = Array.isArray(lesson.points) ? lesson.points : [];
        const firstChunk = points.slice(0, 2);
        const secondChunk = points.slice(2, 4);
        const thirdChunk = points.slice(4);

        return [
            {
                title: `${lesson.title} Overview`,
                lessonText: `${lesson.summary}\n\nThis slide gives learners the core context they need before they start hands-on work.`,
                keyNotes: firstChunk.join('\n')
            },
            {
                title: `${lesson.title} Practical Focus`,
                lessonText: `${lesson.subtitle}\n\nUse this section to connect the concept to the actual tools, terminology, and actions seen on the job.`,
                keyNotes: secondChunk.join('\n')
            },
            {
                title: `${lesson.title} Field Checklist`,
                lessonText: 'This final slide frames the lesson like a real task: what to verify, what to document, and what good output looks like for a technician or junior professional.',
                keyNotes: thirdChunk.join('\n')
            }
        ];
    }

    function createAssessmentQuestions(levelIndex, lessonTitle) {
        const multipleChoiceCount = levelIndex >= 2 ? 15 : 10;
        const essayCount = levelIndex >= 2 ? 3 : 0;
        const questions = [];

        for (let index = 0; index < multipleChoiceCount; index += 1) {
            questions.push({
                id: `question-${levelIndex + 1}-${index + 1}-${slugify(lessonTitle)}`,
                number: questions.length + 1,
                type: 'multiple-choice',
                prompt: `${lessonTitle}: multiple-choice question ${index + 1}`,
                choices: [
                    'Option A',
                    'Option B',
                    'Option C',
                    'Option D'
                ],
                answerIndex: 0,
                rubric: ''
            });
        }

        for (let index = 0; index < essayCount; index += 1) {
            questions.push({
                id: `essay-${levelIndex + 1}-${index + 1}-${slugify(lessonTitle)}`,
                number: questions.length + 1,
                type: 'essay',
                prompt: `${lessonTitle}: essay question ${index + 1}`,
                choices: [],
                answerIndex: 0,
                rubric: 'Use this answer space to evaluate the learner’s reasoning, practical judgment, and clarity.'
            });
        }

        return questions;
    }

    function createLesson(courseId, levelIndex, lessonIndex, lesson) {
        const lessonId = `${courseId}-level-${levelIndex + 1}-lesson-${lessonIndex + 1}`;
        const slides = createLessonSlides(lesson);
        const questions = createSampleAssessmentQuestions(levelIndex, lesson.title);
        const assessment = createLessonAssessment(lessonId, lesson.title, questions, levelIndex + 1);
        return {
            id: lessonId,
            title: lesson.title,
            subtitle: lesson.subtitle,
            slideCount: slides.length,
            duration: formatSlidesLabel(slides.length),
            slides,
            questions,
            assessments: [assessment]
        };
    }

    function createSampleAssessmentQuestions(levelIndex, lessonTitle) {
        const multipleChoiceCount = levelIndex >= 2 ? 15 : 10;
        const essayCount = levelIndex >= 2 ? 3 : 0;
        const questions = [];
        const mcqTemplates = [
            {
                prompt: `Which statement best describes the main goal of "${lessonTitle}"?`,
                choices: [
                    `Understand the core workflow behind ${lessonTitle.toLowerCase()}`,
                    'Memorize unrelated terms without context',
                    'Skip process and rely on trial and error',
                    'Focus only on buying tools'
                ],
                answerIndex: 0
            },
            {
                prompt: `Which action is the safest starting point when working on "${lessonTitle}" in a real environment?`,
                choices: [
                    'Document the current setup before making changes',
                    'Change multiple settings at once to save time',
                    'Ignore existing standards and improvise',
                    'Rely only on memory instead of notes'
                ],
                answerIndex: 0
            },
            {
                prompt: `Why does "${lessonTitle}" matter for entry-level IT work?`,
                choices: [
                    'It supports repeatable troubleshooting and better decisions',
                    'It removes the need for documentation',
                    'It guarantees every issue is hardware-related',
                    'It replaces all other technical skills'
                ],
                answerIndex: 0
            },
            {
                prompt: `Which habit improves accuracy while performing tasks related to "${lessonTitle}"?`,
                choices: [
                    'Validate each step and record the result',
                    'Jump to the last step immediately',
                    'Work without checking requirements',
                    'Avoid asking clarifying questions'
                ],
                answerIndex: 0
            },
            {
                prompt: `What is the strongest reason to learn "${lessonTitle}" before moving to more advanced topics?`,
                choices: [
                    'It creates the foundation needed for higher-level work',
                    'It removes the need to understand fundamentals',
                    'It is useful only in school projects',
                    'It makes security and testing unnecessary'
                ],
                answerIndex: 0
            }
        ];
        const essayTemplates = [
            `A client reports a problem related to "${lessonTitle}". Explain how you would assess the issue, what information you would gather first, and how you would communicate your findings.`,
            `Describe a realistic workplace scenario where "${lessonTitle}" affects service quality or reliability. Explain the risks, your response, and how you would justify your decisions.`,
            `If you were responsible for reviewing another technician's work in "${lessonTitle}", what standards or checkpoints would you use and why?`,
            `Explain how poor decisions in "${lessonTitle}" could affect users, security, or business operations. Use a concrete example in your answer.`,
            `Compare a rushed approach versus a professional approach to "${lessonTitle}". What are the tradeoffs, and which outcome would you defend in front of a supervisor or client?`
        ];

        for (let index = 0; index < multipleChoiceCount; index += 1) {
            const template = mcqTemplates[index % mcqTemplates.length];
            questions.push({
                id: `sample-question-${levelIndex + 1}-${index + 1}-${slugify(lessonTitle)}`,
                number: questions.length + 1,
                type: 'multiple-choice',
                prompt: template.prompt,
                choices: template.choices,
                answerIndex: template.answerIndex,
                rubric: ''
            });
        }

        for (let index = 0; index < essayCount; index += 1) {
            questions.push({
                id: `sample-essay-${levelIndex + 1}-${index + 1}-${slugify(lessonTitle)}`,
                number: questions.length + 1,
                type: 'essay',
                prompt: essayTemplates[index % essayTemplates.length],
                choices: [],
                answerIndex: 0,
                rubric: 'Evaluate clarity, technical reasoning, practical judgment, and how well the response connects decisions to real outcomes.'
            });
        }

        return questions;
    }

    function createLevel(courseId, levelIndex, level) {
        return {
            id: `${courseId}-level-${levelIndex + 1}`,
            title: level.title,
            description: level.description,
            price: level.price,
            lessons: level.lessons.map((lesson, lessonIndex) => createLesson(courseId, levelIndex, lessonIndex, lesson))
        };
    }

    function createCourse(course) {
        const levels = course.levels.map((level, levelIndex) => createLevel(course.id, levelIndex, level));
        const totalSlides = countCourseSlides({ levels });
        return {
            id: course.id,
            title: course.title,
            creator: course.creator,
            description: course.description,
            thumbnail: course.thumbnail,
            badge: course.badge,
            rating: course.rating,
            reviews: course.reviews,
            duration: formatSlidesLabel(totalSlides),
            totalSlides,
            students: course.students,
            status: 'approved',
            levels
        };
    }

    const seedCourses = [
        createCourse({
            id: 'networking-support-infrastructure',
            title: 'Networking Support and Infrastructure',
            creator: 'Engr. Miguel Santos',
            description: 'A market-ready path into network support, office deployments, troubleshooting, and entry-level infrastructure operations.',
            thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop',
            badge: 'Trending',
            rating: '4.9',
            reviews: '4,120 reviews',
            students: '18,200',
            levels: [
                levelSpec('Level 1: Networking Foundations', 'Free starter track for learners building core networking vocabulary and device familiarity.', 0, [
                    lessonSpec('How Networks Move Data', 'Packets, frames, and traffic flow', 'Build a mental model for how devices exchange data across a local network and beyond.', [
                        'Packets, frames, and ports serve different roles',
                        'Switches forward inside the LAN while routers move traffic between networks',
                        'Latency, bandwidth, and packet loss shape user experience',
                        'Broadcast traffic behaves differently from directed traffic',
                        'Every ticket starts with identifying the path of traffic',
                        'Accurate notes reduce repeated troubleshooting'
                    ]),
                    lessonSpec('IP Addressing and Subnet Basics', 'Private ranges and subnet boundaries', 'Introduce addressing concepts that every support technician needs before configuring devices or reading a network diagram.', [
                        'IPv4 addresses identify hosts on a network',
                        'Subnet masks define which devices are local',
                        'Private IP ranges are common in office environments',
                        'Default gateways send traffic outside the local subnet',
                        'Duplicate addresses cause intermittent failures',
                        'Basic subnet reading helps during device onboarding'
                    ]),
                    lessonSpec('Routers, Switches, and Access Points', 'Know what each device is for', 'Separate the job of common network devices so learners stop treating every box with lights as the same thing.', [
                        'Switches connect wired endpoints inside the same network',
                        'Routers connect networks and enforce path decisions',
                        'Access points bridge wireless users into the LAN',
                        'Firewalls add policy and filtering controls',
                        'Managed devices give better visibility than unmanaged gear',
                        'Small office designs still benefit from documented roles'
                    ]),
                    lessonSpec('Cabling, Wi-Fi, and Site Basics', 'Physical layer fundamentals', 'Cover what learners should inspect onsite before they blame software for a physical or wireless problem.', [
                        'Cable category affects speed and distance expectations',
                        'Terminations and patching must be consistent and labeled',
                        'Wi-Fi performance depends on interference and placement',
                        'Power, heat, and airflow matter in network closets',
                        'A bad uplink can look like a random user complaint',
                        'Simple site sketches make upgrades easier later'
                    ])
                ]),
                levelSpec('Level 2: Support and Troubleshooting', 'Free practical track for branch setups, service tickets, and core network operations.', 0, [
                    lessonSpec('Configuring SOHO and Branch Networks', 'Practical rollout steps', 'Walk through the normal order of work when deploying or refreshing a small office network.', [
                        'Start with ISP handoff, scope, and addressing plan',
                        'Document WAN, LAN, and wireless settings before turnover',
                        'Separate staff, guest, and device traffic where possible',
                        'Check DHCP scopes and reserved addresses early',
                        'Validate internet, printer, and file-share access',
                        'Leave behind a clean handover document'
                    ]),
                    lessonSpec('VLANs, DHCP, and DNS in Practice', 'Core services that keep offices running', 'Connect logical segmentation with the services users depend on every day.', [
                        'VLANs separate traffic for security and stability',
                        'DHCP automates endpoint addressing',
                        'DNS translates hostnames into reachable destinations',
                        'Mismatched VLAN and DHCP scopes break onboarding',
                        'Wrong DNS settings often appear as internet issues',
                        'Testing by role is better than testing one device only'
                    ]),
                    lessonSpec('Troubleshooting Connectivity and Speed', 'A repeatable support workflow', 'Teach a structure for isolating symptoms without jumping straight to random fixes.', [
                        'Confirm whether the issue is one user or many',
                        'Work from physical layer to application layer',
                        'Ping, traceroute, and adapter checks reveal common faults',
                        'Wireless complaints need signal and interference context',
                        'Speed tests are useful only with baseline expectations',
                        'Good escalation notes save senior engineer time'
                    ]),
                    lessonSpec('Monitoring and Documentation Basics', 'Operational habits for reliability', 'Introduce the habits that make environments supportable after the installation is finished.', [
                        'Monitoring should cover device health and uplink state',
                        'Alert noise must be reduced to keep teams responsive',
                        'Diagrams help non-creators support the environment',
                        'Label ports, patch panels, and uplinks consistently',
                        'Change logs explain why network behavior changed',
                        'Documentation is part of reliability, not optional admin work'
                    ])
                ]),
                levelSpec('Level 3: Professional Infrastructure Work', 'Paid advanced track focused on design decisions, resilience, and client-ready delivery.', 249, [
                    lessonSpec('Designing Secure Office Networks', 'Segmentation, resilience, and access control', 'Move from simple connectivity into intentional network design for real business use.', [
                        'Separate critical systems from general user traffic',
                        'Design uplinks and firewall policy before deployment day',
                        'Remote access should follow least-privilege principles',
                        'Guest networks should not expose internal resources',
                        'Design choices must match business risk and budget',
                        'A secure design is easier to support than a flat network'
                    ]),
                    lessonSpec('Routing, Redundancy, and Segmentation', 'Keeping the business online', 'Expose learners to the concepts behind reliable multi-site and higher-availability environments.', [
                        'Static routing is simple but limited at scale',
                        'Segmentation controls fault domains and access boundaries',
                        'Redundant links need clear failover expectations',
                        'Spanning-tree and loops remain practical concerns',
                        'Change windows matter when core paths are touched',
                        'Rollback planning is part of professional execution'
                    ]),
                    lessonSpec('Wireless Site Survey and Capacity Planning', 'From signal coverage to usable Wi-Fi', 'Help learners think beyond signal bars and into actual client density and interference.', [
                        'Coverage and capacity are different design targets',
                        'Access point placement should follow site materials and use cases',
                        'Channel planning reduces co-channel interference',
                        'Guest, voice, and corporate traffic need different expectations',
                        'Validation requires walking the environment after install',
                        'Survey notes support later expansion and troubleshooting'
                    ]),
                    lessonSpec('Professional Incident Response for Network Teams', 'Handling outages with discipline', 'Focus on how professionals communicate and recover when a business-affecting incident hits the network.', [
                        'Triage needs scope, timeline, and business impact',
                        'Containment should avoid making the outage wider',
                        'Status updates must be clear and consistent',
                        'Evidence and logs matter for root-cause analysis',
                        'Post-incident reviews should produce action items',
                        'Professionalism shows most during service disruption'
                    ])
                ])
            ]
        }),
        createCourse({
            id: 'computer-hardware-it-support',
            title: 'Computer Hardware and IT Support',
            creator: 'Rafael Dela Cruz',
            description: 'Entry-level to professional desktop support, repair workflows, device care, and service desk fundamentals.',
            thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop',
            badge: 'Popular',
            rating: '4.8',
            reviews: '3,780 reviews',
            students: '16,400',
            levels: [
                levelSpec('Level 1: Computer Basics', 'Free foundation track for learners who want to understand PC components and day-one support tasks.', 0, [
                    lessonSpec('PC Components and Upgrade Paths', 'What each internal part does', 'Give learners a clean map of core desktop and laptop components before they touch upgrades or repairs.', [
                        'CPU, RAM, storage, and motherboard all affect performance differently',
                        'Form factor limits what can be upgraded',
                        'Power supply quality impacts overall stability',
                        'Thermals matter even in office machines',
                        'Compatibility checks prevent wasted purchases',
                        'A support tech should read model and serial data first'
                    ]),
                    lessonSpec('Windows Installation and Driver Setup', 'From clean install to usable workstation', 'Walk through what a proper workstation build looks like after the operating system is deployed.', [
                        'Install media should match the target device and license',
                        'Chipset, graphics, and network drivers restore full functionality',
                        'Updates close security gaps early',
                        'User profiles and naming standards reduce confusion later',
                        'Base applications should follow a standard image or checklist',
                        'A build is not complete until it has been validated'
                    ]),
                    lessonSpec('Helpdesk Troubleshooting Workflow', 'Think like a support technician', 'Introduce a repeatable method for handling end-user problems without guessing.', [
                        'Capture the symptom in the user’s own words',
                        'Reproduce the issue when possible',
                        'Check recent changes before broad fixes',
                        'Simple causes should be ruled out first',
                        'Document what was tested and what changed',
                        'Know when to escalate instead of improvising'
                    ]),
                    lessonSpec('Endpoint Security and Backup Basics', 'Protecting user devices and data', 'Cover the minimum controls every support technician should enforce on business endpoints.', [
                        'Updates and endpoint protection reduce common risk',
                        'Standard users should not run with local admin by default',
                        'Backups need both schedule and restore testing',
                        'Phishing and removable media remain frequent threats',
                        'Lost devices should be treated as possible incidents',
                        'Support teams help enforce security through routine process'
                    ])
                ]),
                levelSpec('Level 2: Operational Support', 'Free practical track for troubleshooting, imaging, and day-to-day service delivery.', 0, [
                    lessonSpec('Diagnosing Boot and Performance Issues', 'Find the bottleneck before replacing parts', 'Help learners distinguish between software, storage, thermal, and hardware causes of slow or unstable systems.', [
                        'Boot failure is not the same as slow startup',
                        'Storage health strongly affects responsiveness',
                        'Background tasks and startup load distort performance',
                        'Thermal throttling can look like random lag',
                        'Memory pressure should be validated with actual metrics',
                        'A diagnosis should end with evidence, not guesswork'
                    ]),
                    lessonSpec('Storage, Imaging, and Recovery', 'Prepare systems for reuse and failure recovery', 'Move into practical workflows used by support teams when devices are replaced or recovered.', [
                        'Disk cloning speeds up repeat deployments',
                        'Recovery media should exist before failure happens',
                        'BitLocker and encryption affect repair planning',
                        'Backup retention must match business needs',
                        'Imaging processes reduce workstation drift',
                        'Recovery success depends on tested procedures'
                    ]),
                    lessonSpec('Peripherals, Printers, and User Support', 'The issues users actually open tickets for', 'Focus on everyday support tasks that shape user satisfaction in small offices and schools.', [
                        'Driver mismatch is a common print issue',
                        'USB and Bluetooth problems often trace back to power or pairing',
                        'Shared printer access depends on both network and permissions',
                        'Consumables and maintenance kits affect printer reliability',
                        'User instructions should be simple and repeatable',
                        'Support quality is measured by clarity as much as speed'
                    ]),
                    lessonSpec('Asset Management and Service Documentation', 'Support that scales beyond one technician', 'Show how inventory and records improve accountability and long-term maintenance.', [
                        'Assets need tags, ownership, and warranty data',
                        'A ticket trail explains repeated incidents',
                        'Lifecycle planning reduces surprise replacement costs',
                        'Stocking the right spare parts shortens downtime',
                        'Documentation protects teams during handover',
                        'Support maturity shows up in records, not only fixes'
                    ])
                ]),
                levelSpec('Level 3: Professional Repair and Support Delivery', 'Paid advanced track for technicians supporting business devices and service standards.', 199, [
                    lessonSpec('Advanced Laptop and Desktop Repair', 'Component-level replacement workflow', 'Frame repair work around diagnosis, safe disassembly, and verification after replacement.', [
                        'Board inspection starts with power and visible damage',
                        'Laptop repairs need model-specific teardown discipline',
                        'Thermal pads, paste, and screw mapping matter',
                        'Replacement parts should be checked for compatibility and quality',
                        'Post-repair testing must include stress and user tasks',
                        'Repair notes protect both technician and customer'
                    ]),
                    lessonSpec('Business Continuity for Small Offices', 'Reducing downtime impact', 'Connect endpoint support with the broader goal of keeping a team productive during failures.', [
                        'Critical users and devices should be identified before outages',
                        'Hot spares and images speed up response',
                        'Recovery priorities should reflect business value',
                        'Cloud backups do not remove restore planning',
                        'Communication during downtime prevents confusion',
                        'Continuity is a support discipline, not only management planning'
                    ]),
                    lessonSpec('Power, Cooling, and Preventive Maintenance', 'Keeping systems reliable over time', 'Turn maintenance from reactive cleanup into a documented reliability habit.', [
                        'Dust and heat shorten component life',
                        'UPS sizing should match load and shutdown expectations',
                        'Battery health matters for mobile fleets',
                        'Preventive cleaning must follow device-safe methods',
                        'Failure trends appear earlier when maintenance is logged',
                        'Reliability improves when routine checks are scheduled'
                    ]),
                    lessonSpec('Professional Support Escalation and SLAs', 'Working inside real support teams', 'Prepare learners for service commitments, triage rules, and communication expected in paid support roles.', [
                        'Priority should match business impact, not only user frustration',
                        'Escalations need concise technical evidence',
                        'SLA targets influence workflow and queue handling',
                        'Senior engineers need clean notes, not long stories',
                        'Customer updates should be timely and factual',
                        'Professional support means predictable process under pressure'
                    ])
                ])
            ]
        }),
        createCourse({
            id: 'cybersecurity-operations-fundamentals',
            title: 'Cybersecurity Operations Fundamentals',
            creator: 'Alyssa Navarro',
            description: 'A practical starting path for security-minded learners moving toward SOC, GRC, or defensive security support roles.',
            thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=250&fit=crop',
            badge: 'Popular',
            rating: '4.9',
            reviews: '4,860 reviews',
            students: '21,300',
            levels: [
                levelSpec('Level 1: Security Foundations', 'Free starter track covering the mindset, terminology, and day-one security hygiene used across IT teams.', 0, [
                    lessonSpec('Security Mindset and Threat Landscape', 'Why defensive thinking matters', 'Introduce modern security work as risk reduction, not fear-driven guesswork.', [
                        'Threat actors range from casual scammers to organized groups',
                        'Attack surface grows with users, devices, and cloud tools',
                        'Not every vulnerability becomes a real business risk',
                        'Security work balances protection with usability',
                        'Good defense starts with visibility and priorities',
                        'People, process, and technology all affect exposure'
                    ]),
                    lessonSpec('Identity, Passwords, and MFA', 'Protecting access at the first layer', 'Show learners why identity controls matter even more than perimeter thinking in modern environments.', [
                        'Weak passwords remain a common entry point',
                        'MFA blocks many routine account attacks',
                        'Shared accounts remove accountability',
                        'Role-based access reduces accidental exposure',
                        'Password managers help users succeed securely',
                        'Identity events should be monitored, not ignored'
                    ]),
                    lessonSpec('Safe Browsing, Email, and Social Engineering', 'Human-layer defense', 'Focus on the attack methods ordinary employees face most often and how defenders respond.', [
                        'Phishing often uses urgency and impersonation',
                        'Unexpected attachments and links deserve verification',
                        'Browser warnings should not be trained away',
                        'Users need simple reporting paths for suspicious messages',
                        'Security awareness works best when tied to real examples',
                        'One good report can prevent a wider incident'
                    ]),
                    lessonSpec('Basic Logs, Alerts, and Incident Terms', 'Speaking the language of security operations', 'Prepare learners to read simple security dashboards and understand what common alert terms mean.', [
                        'Logs are records of system and user activity',
                        'An alert is a signal, not proof of compromise',
                        'False positives waste time if not triaged properly',
                        'Containment, eradication, and recovery mean different stages',
                        'Severity should align with business impact',
                        'Time stamps and context matter during investigations'
                    ])
                ]),
                levelSpec('Level 2: Defensive Operations', 'Free practical track introducing common workflows used by entry-level security and IT operations teams.', 0, [
                    lessonSpec('Vulnerability Management Workflow', 'Finding and reducing known weakness', 'Map the routine cycle of scanning, prioritizing, fixing, and verifying exposures.', [
                        'Scans find volume, but teams still need prioritization',
                        'Asset context changes what is urgent',
                        'Patch windows must align with operations',
                        'Exceptions need clear business justification',
                        'Verification closes the loop after remediation',
                        'Trend tracking helps teams improve over time'
                    ]),
                    lessonSpec('Endpoint Protection and Hardening', 'Reducing attacker opportunity', 'Show how standard endpoint controls block common attacks before an incident escalates.', [
                        'Baseline configuration is the starting point for trust',
                        'Unused services increase attack surface',
                        'Application control can reduce risky execution paths',
                        'EDR helps teams investigate suspicious endpoint behavior',
                        'Hardening should not break core business tasks',
                        'Control drift grows when exceptions are unmanaged'
                    ]),
                    lessonSpec('SIEM Basics and Alert Triage', 'Turning data into action', 'Introduce how teams use centralized logs and triage decisions to focus on meaningful events.', [
                        'SIEM platforms aggregate logs from many sources',
                        'Use cases determine which alerts matter most',
                        'Triage should start with identity, host, and timeline context',
                        'Escalation is stronger when evidence is summarized well',
                        'Repeated false positives should be tuned carefully',
                        'Analysts need both curiosity and disciplined note-taking'
                    ]),
                    lessonSpec('Intro to Network Security Monitoring', 'Watching the environment beyond endpoints', 'Extend defense thinking into traffic, DNS, and service behavior that can reveal suspicious activity.', [
                        'North-south and east-west traffic tell different stories',
                        'DNS can expose command-and-control patterns',
                        'Unexpected ports or geographies deserve attention',
                        'Packet capture is useful when scoped correctly',
                        'Baseline behavior makes anomaly spotting easier',
                        'Network signals should be correlated with endpoint evidence'
                    ])
                ]),
                levelSpec('Level 3: Job-Ready Security Operations', 'Paid advanced track for learners preparing for analyst-style tasks and professional reporting.', 299, [
                    lessonSpec('Incident Response Playbooks', 'Working through an event with discipline', 'Teach how teams standardize response so incidents are handled consistently even under pressure.', [
                        'Playbooks reduce confusion during urgent events',
                        'Roles should be assigned before a real incident',
                        'Containment choices can affect business continuity',
                        'Evidence preservation matters for later analysis',
                        'Communications should fit technical and non-technical audiences',
                        'Lessons learned should change future process'
                    ]),
                    lessonSpec('Investigating Phishing and Malware Alerts', 'From suspicious message to verified finding', 'Focus on the practical analysis steps junior analysts often perform in real security teams.', [
                        'Headers, sender reputation, and URLs provide early clues',
                        'Attachment handling should follow safe analysis process',
                        'Host impact needs to be checked beyond the email itself',
                        'User interviews can clarify whether interaction occurred',
                        'Escalation should include concise evidence and impact',
                        'Good analysts separate observation from assumption'
                    ]),
                    lessonSpec('Writing Security Findings and Recommendations', 'Reporting that leads to action', 'Prepare learners to turn technical observations into business-relevant recommendations.', [
                        'A finding should state what happened and why it matters',
                        'Risk language should match the real exposure',
                        'Recommendations need to be actionable and prioritized',
                        'Evidence should support each conclusion',
                        'Clear writing improves trust in the security team',
                        'Strong reports reduce repeated explanation work'
                    ]),
                    lessonSpec('Compliance, Risk, and Professional Reporting', 'Security beyond tools and alerts', 'Position security work inside governance, client expectations, and audit readiness.', [
                        'Compliance frameworks shape required controls',
                        'Risk registers help teams prioritize remediation',
                        'Exceptions should be documented and reviewed',
                        'Audit evidence must be organized and repeatable',
                        'Metrics should reflect effectiveness, not vanity counts',
                        'Professional reporting connects controls to business outcomes'
                    ])
                ])
            ]
        }),
        createCourse({
            id: 'linux-system-administration',
            title: 'Linux System Administration',
            creator: 'Joel Ramirez',
            description: 'A practical path into Linux operations for support staff, junior sysadmins, and infrastructure learners.',
            thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&h=250&fit=crop',
            badge: 'New',
            rating: '4.7',
            reviews: '2,960 reviews',
            students: '12,900',
            levels: [
                levelSpec('Level 1: Linux Fundamentals', 'Free starter track for command-line basics, permissions, packages, and everyday admin awareness.', 0, [
                    lessonSpec('Linux Distributions and Shell Basics', 'Start using the terminal with purpose', 'Introduce learners to the Linux ecosystem and the shell habits needed for confident exploration.', [
                        'Different distributions package tools in different ways',
                        'The shell is a fast interface for repeatable work',
                        'Path awareness prevents accidental actions',
                        'Command history improves speed and consistency',
                        'Help pages are part of normal workflow',
                        'Confidence grows by testing commands in safe scope'
                    ]),
                    lessonSpec('Files, Permissions, and Users', 'Access control at the operating-system level', 'Build the permission model that underpins server administration and multi-user environments.', [
                        'Ownership determines who can manage a file',
                        'Read, write, and execute are separate permissions',
                        'Groups simplify repeated access management',
                        'Least privilege matters on Linux too',
                        'Permission mistakes can break services or expose data',
                        'User administration should be documented in shared environments'
                    ]),
                    lessonSpec('Package Management and Updates', 'Keeping systems current and stable', 'Teach the basics of installing, updating, and validating software from trusted repositories.', [
                        'Package managers reduce manual software drift',
                        'Updates should consider service impact and dependencies',
                        'Repository trust matters for security',
                        'Version checks help explain behavior differences',
                        'Change windows are useful even on small systems',
                        'Validation after updates prevents hidden failures'
                    ]),
                    lessonSpec('Services, Logs, and System Health', 'Knowing whether the server is okay', 'Give learners a first view of how Linux exposes service state and runtime evidence.', [
                        'Systemd manages many modern Linux services',
                        'Logs are the first stop for troubleshooting',
                        'CPU, memory, and disk trends tell health stories',
                        'Service restarts should follow diagnosis, not guesswork',
                        'Disk space incidents are common and preventable',
                        'Routine checks catch issues before users do'
                    ])
                ]),
                levelSpec('Level 2: Admin Workflows', 'Free practical track for remote access, automation, storage, and common server tasks.', 0, [
                    lessonSpec('Storage, SSH, and Scheduled Tasks', 'Core operations habits for server access', 'Connect three common admin responsibilities that show up in nearly every Linux environment.', [
                        'SSH is the normal path for secure remote administration',
                        'Key-based access is stronger than password-only login',
                        'Storage planning should account for growth and backup',
                        'Cron and timers automate repeatable maintenance work',
                        'Remote access should be logged and controlled',
                        'Simple automation prevents many avoidable incidents'
                    ]),
                    lessonSpec('Web and Database Service Basics', 'Supporting application environments', 'Introduce the service relationships behind common web workloads on Linux.', [
                        'Web servers and databases should be validated separately',
                        'Ports, firewalls, and configs all affect reachability',
                        'Application teams depend on stable service layers',
                        'Logs reveal errors faster than guessing from symptoms',
                        'Backups matter for both config and data',
                        'Change management becomes more important in shared environments'
                    ]),
                    lessonSpec('Bash Scripting for Admin Tasks', 'Automating small but repeated work', 'Show learners how scripting reduces manual mistakes and speeds up routine checks.', [
                        'Scripts should start simple and stay readable',
                        'Variables and exit codes improve reliability',
                        'Logging script output helps with troubleshooting',
                        'Automation should include safety checks',
                        'Repeated manual tasks are automation candidates',
                        'Good scripts are documented and versioned'
                    ]),
                    lessonSpec('Backup and Recovery on Linux', 'Being ready before failure', 'Frame backups as a recovery discipline rather than a checkbox task.', [
                        'A backup is only useful if it can be restored',
                        'Files, databases, and configs need different methods',
                        'Retention should match business and legal needs',
                        'Recovery tests should be scheduled, not assumed',
                        'Offsite copies protect against local loss events',
                        'Documented recovery steps reduce panic during incidents'
                    ])
                ]),
                levelSpec('Level 3: Production Linux Operations', 'Paid advanced track for security, performance, and professional troubleshooting on live systems.', 249, [
                    lessonSpec('Securing Linux Servers', 'Reducing risk on exposed systems', 'Move into the controls and habits expected when Linux hosts business-facing services.', [
                        'Patch discipline is part of baseline security',
                        'SSH exposure should be restricted and monitored',
                        'Unused services should be disabled',
                        'File permissions and sudo rights deserve regular review',
                        'System logs support both detection and investigation',
                        'Security hardening should be tested, not blindly applied'
                    ]),
                    lessonSpec('Performance Tuning and Capacity Checks', 'Knowing when the server is near its limit', 'Help learners investigate slow systems with evidence instead of random tuning attempts.', [
                        'CPU, memory, disk, and network each create different bottlenecks',
                        'Baseline metrics are needed before tuning changes',
                        'Resource spikes should be tied to specific services',
                        'Swap and I/O wait often explain poor responsiveness',
                        'Capacity planning prevents surprise outages',
                        'Performance work should end with measurable validation'
                    ]),
                    lessonSpec('Containers and Systemd Operations', 'Modern runtime management', 'Expose learners to the platform controls they will see in current Linux environments.', [
                        'Containers package applications with fewer host changes',
                        'Systemd keeps service state predictable',
                        'Logs and restart policies affect reliability',
                        'Host security still matters when containers are used',
                        'Troubleshooting must separate host and container layers',
                        'Operations teams need repeatable service definitions'
                    ]),
                    lessonSpec('Production Troubleshooting Workflow', 'Handling service-impacting problems well', 'Pull together Linux operational thinking into a response pattern suitable for real incidents.', [
                        'Scope the outage before changing the system',
                        'Collect evidence while the issue is visible',
                        'Rollback plans should exist before risky changes',
                        'Communicate status with clarity and timing',
                        'Root cause should lead to a preventive action',
                        'Professional troubleshooting values discipline over heroics'
                    ])
                ])
            ]
        }),
        createCourse({
            id: 'cloud-support-microsoft-365',
            title: 'Cloud Support and Microsoft 365 Administration',
            creator: 'Patricia Gomez',
            description: 'A practical route into cloud support roles covering Microsoft 365, identity, endpoint basics, and SMB administration.',
            thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=250&fit=crop',
            badge: 'Popular',
            rating: '4.8',
            reviews: '3,540 reviews',
            students: '14,700',
            levels: [
                levelSpec('Level 1: Cloud and M365 Basics', 'Free entry track for learners starting with cloud concepts, users, and collaboration tools.', 0, [
                    lessonSpec('Cloud Concepts and Shared Responsibility', 'What moves to the provider and what does not', 'Set realistic expectations for cloud platforms so learners understand both benefits and remaining admin duties.', [
                        'Cloud shifts operations but does not remove accountability',
                        'Shared responsibility differs by service type',
                        'Availability and backup are not always the same thing',
                        'Identity becomes central in cloud environments',
                        'Costs and governance still need active management',
                        'Documentation matters in cloud work just as in on-premise IT'
                    ]),
                    lessonSpec('Microsoft 365 Users, Licenses, and Groups', 'The daily admin basics', 'Walk through the objects and assignments admins handle most often in smaller organizations.', [
                        'Users need the right license for expected services',
                        'Groups simplify repeated access changes',
                        'Naming standards prevent messy administration later',
                        'Departures should trigger a standard offboarding process',
                        'Licensing waste can be found through routine review',
                        'Admin roles should be separated where practical'
                    ]),
                    lessonSpec('OneDrive, Teams, and Exchange Basics', 'The collaboration stack learners will support', 'Frame common M365 services around the support questions users ask every day.', [
                        'Exchange handles mailboxes, policies, and message flow',
                        'Teams depends on identity and collaboration settings',
                        'OneDrive sync issues often trace back to client state or permissions',
                        'Shared files need ownership and retention planning',
                        'Support teams should know where each issue belongs',
                        'User adoption improves when guidance is simple'
                    ]),
                    lessonSpec('Identity Basics with Entra ID', 'Understanding the directory layer', 'Introduce the identity platform behind access control, sign-ins, and admin visibility.', [
                        'Entra ID acts as the identity source for many Microsoft services',
                        'Sign-in logs help explain access problems',
                        'Group membership changes service access quickly',
                        'Admin roles need stronger controls than normal users',
                        'Hybrid identity adds complexity that must be planned',
                        'Identity troubleshooting starts with the account context'
                    ])
                ]),
                levelSpec('Level 2: Cloud Admin Workflows', 'Free practical track for endpoint policies, collaboration administration, and support process.', 0, [
                    lessonSpec('Device Enrollment and Endpoint Policies', 'Bringing managed devices under control', 'Show how cloud admins support productivity while keeping company devices governed.', [
                        'Enrollment gives visibility into device compliance',
                        'Policy design should reflect real user groups',
                        'Lost or stale devices should be reviewed regularly',
                        'Conditional access often depends on device state',
                        'Policy changes need testing before wide rollout',
                        'Support teams need a clear rollback path for broken policies'
                    ]),
                    lessonSpec('Mail Flow, Anti-Spam, and Collaboration Controls', 'Keeping communication usable and safe', 'Connect email delivery with the security and collaboration settings admins manage routinely.', [
                        'Mail flow issues can stem from config, reputation, or policy',
                        'Anti-spam tuning should reduce risk without blocking business',
                        'External sharing needs clear boundaries',
                        'Shared mailboxes and aliases require ownership rules',
                        'Teams governance helps avoid sprawl and confusion',
                        'Communication services need both technical and policy thinking'
                    ]),
                    lessonSpec('SharePoint and Teams Administration', 'Support for modern document and team spaces', 'Move beyond user basics into the structures that keep collaboration environments sustainable.', [
                        'Site ownership determines who can support content safely',
                        'Permissions should follow role and business need',
                        'Naming, lifecycle, and retention improve discoverability',
                        'Excessive sprawl creates support and compliance risk',
                        'Changes should be communicated before they affect users',
                        'Good collaboration admin balances flexibility and governance'
                    ]),
                    lessonSpec('Backup, Retention, and Support Workflow', 'Operational readiness in the cloud', 'Frame support as an operational service that combines policy, recovery, and user communication.', [
                        'Retention settings influence recovery expectations',
                        'Support teams should know what can and cannot be restored',
                        'Tickets need enough context to avoid back-and-forth',
                        'Admin actions should be logged for accountability',
                        'Escalation should include scope and business impact',
                        'Cloud support still depends on disciplined process'
                    ])
                ]),
                levelSpec('Level 3: Professional Cloud Administration', 'Paid advanced track for zero-trust basics, automation, and business-ready cloud operations.', 279, [
                    lessonSpec('Conditional Access and Zero Trust Basics', 'Modern access control for cloud environments', 'Prepare learners for policy-based access decisions used in current SMB and enterprise environments.', [
                        'Zero trust means verifying context continuously',
                        'Conditional access should focus on risk and role',
                        'Policy conflicts create confusing user experience',
                        'Break-glass access needs careful control',
                        'Admin accounts deserve stricter policy than normal users',
                        'Testing and staged rollout reduce lockout risk'
                    ]),
                    lessonSpec('Automation with PowerShell and Admin Portals', 'Reducing repetitive admin work', 'Show how cloud admins scale routine tasks with safe automation and clear process.', [
                        'Portals are useful, but repeatable work benefits from scripting',
                        'Bulk changes should be tested on a small scope first',
                        'Automation must include validation and logging',
                        'Role permissions affect what scripts can do',
                        'Documented scripts reduce single-person dependency',
                        'Efficiency matters more when user counts grow'
                    ]),
                    lessonSpec('Incident Handling for Cloud Admins', 'Responding when access or services fail', 'Connect cloud admin work with clear incident response and stakeholder communication.', [
                        'Service impact should be scoped quickly',
                        'Vendor status pages provide context but not full answers',
                        'Tenant logs help separate local from platform-wide issues',
                        'Containment should protect users without breaking business unnecessarily',
                        'Post-incident notes improve future recovery speed',
                        'Professional cloud admins communicate clearly during disruption'
                    ]),
                    lessonSpec('Building a Reliable SMB Cloud Environment', 'Turning tools into a supportable service', 'Tie together identity, policy, licensing, and documentation into a stable cloud operating model.', [
                        'Standards reduce admin drift across users and devices',
                        'Licensing, policy, and support should be reviewed together',
                        'Security settings need business owner buy-in',
                        'Documentation helps small teams support larger environments',
                        'Reliability comes from process as much as platform',
                        'Good cloud admin work is visible in consistency'
                    ])
                ])
            ]
        })
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function slugify(value) {
        return (value || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `course-${Date.now()}`;
    }

    function generateCourseId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        const timestamp = Date.now().toString(16).padStart(12, '0');
        const randomPart = 'xxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
            Math.floor(Math.random() * 16).toString(16)
        );

        return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-4${randomPart.slice(0, 3)}-a${randomPart.slice(3, 6)}-${randomPart.slice(6, 18)}`;
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn(`Unable to parse ${key}:`, error);
            return fallback;
        }
    }

    function isStorageQuotaError(error) {
        return error?.name === 'QuotaExceededError'
            || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || error?.code === 22
            || error?.code === 1014;
    }

    function shouldCompactInlineMedia(key, value, mode = 'video') {
        if (typeof value !== 'string') {
            return false;
        }

        if (key === 'dataUrl' && value.startsWith('data:video/')) {
            return true;
        }

        return mode === 'all'
            && ((key === 'dataUrl' && value.length > MAX_INLINE_MEDIA_STORAGE_LENGTH)
                || (key === 'visualDataUrl' && value.length > MAX_INLINE_MEDIA_STORAGE_LENGTH));
    }

    function compactLargeInlineMedia(value, key = '', mode = 'video') {
        if (shouldCompactInlineMedia(key, value, mode)) {
            return '';
        }

        if (Array.isArray(value)) {
            return value.map((item) => compactLargeInlineMedia(item, '', mode));
        }

        if (value && typeof value === 'object') {
            return Object.entries(value).reduce((result, [entryKey, entryValue]) => {
                result[entryKey] = compactLargeInlineMedia(entryValue, entryKey, mode);
                if (shouldCompactInlineMedia(entryKey, entryValue, mode)) {
                    result.mediaOmittedForStorage = true;
                }
                return result;
            }, {});
        }

        return value;
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            if (!isStorageQuotaError(error)) {
                throw error;
            }

            const compactedValue = compactLargeInlineMedia(value, '', 'video');

            try {
                localStorage.setItem(key, JSON.stringify(compactedValue));
                sessionStorage.setItem('simpStorageCompactedMedia', 'video');
                console.warn(`${key} exceeded browser storage quota. Large inline videos were omitted so the course data could be saved.`);
            } catch (retryError) {
                if (!isStorageQuotaError(retryError)) {
                    throw retryError;
                }

                const aggressivelyCompactedValue = compactLargeInlineMedia(value, '', 'all');
                localStorage.setItem(key, JSON.stringify(aggressivelyCompactedValue));
                sessionStorage.setItem('simpStorageCompactedMedia', 'all');
                console.warn(`${key} exceeded browser storage quota. Large inline media was omitted so the course data could be saved.`);
            }
        }
    }

    function normalizeQuestionType(type) {
        return ['essay', 'identification', 'matching'].includes(type) ? type : 'multiple-choice';
    }

    function createEmptyMatchingPairs() {
        return [
            { prompt: '', match: '' },
            { prompt: '', match: '' },
            { prompt: '', match: '' }
        ];
    }

    function normalizeAssessmentQuestions(questions) {
        return (Array.isArray(questions) ? questions : []).map((question, index) => {
            const type = normalizeQuestionType(question?.type);
            return {
                ...question,
                id: question?.id || `question-${Date.now()}-${index + 1}`,
                number: index + 1,
                type,
                prompt: question?.prompt || question?.question || '',
                choices: type === 'multiple-choice'
                    ? (Array.isArray(question?.choices)
                        ? question.choices
                        : (Array.isArray(question?.options) ? question.options : ['', '', '', '']))
                    : [],
                answerIndex: Number.isInteger(question?.answerIndex) ? question.answerIndex : 0,
                rubric: question?.rubric || '',
                correctAnswer: question?.correctAnswer || '',
                pairs: type === 'matching'
                    ? (Array.isArray(question?.pairs) && question.pairs.length ? question.pairs : createEmptyMatchingPairs())
                    : []
            };
        });
    }

    function estimateAssessmentDuration(questions) {
        const multipleChoiceCount = questions.filter((question) => question.type !== 'essay').length;
        const essayCount = questions.filter((question) => question.type === 'essay').length;
        return Math.max(10, multipleChoiceCount + (essayCount * 6));
    }

    function createLessonAssessment(lessonId, lessonTitle, questions, levelNumber) {
        const normalizedQuestions = normalizeAssessmentQuestions(questions);
        const essayCount = normalizedQuestions.filter((question) => question.type === 'essay').length;
        return {
            id: `${lessonId}-assessment`,
            title: `${lessonTitle || 'Lesson'} Assessment`,
            description: essayCount
                ? 'Includes multiple-choice and essay questions for applied understanding.'
                : 'Multiple-choice assessment based on the lesson content.',
            duration: estimateAssessmentDuration(normalizedQuestions),
            totalQuestions: normalizedQuestions.length,
            passingScore: levelNumber >= 3 ? 80 : 70,
            isDraft: true,
            questions: normalizedQuestions
        };
    }

    function normalizeAssessments(lesson, seedLesson, levelNumber) {
        const seedQuestions = Array.isArray(seedLesson?.questions) ? clone(seedLesson.questions) : [];
        const legacyQuestions = Array.isArray(lesson?.questions) ? lesson.questions : [];
        const seedAssessments = Array.isArray(seedLesson?.assessments) ? clone(seedLesson.assessments) : [];
        const sourceAssessments = Array.isArray(lesson?.assessments) && lesson.assessments.length
            ? lesson.assessments
            : (seedAssessments.length ? seedAssessments : []);

        if (sourceAssessments.length) {
            return sourceAssessments.map((assessment, index) => {
                const fallbackQuestions = index === 0 && legacyQuestions.length ? legacyQuestions : seedQuestions;
                const normalizedQuestions = normalizeAssessmentQuestions(
                    Array.isArray(assessment?.questions) && assessment.questions.length
                        ? assessment.questions
                        : fallbackQuestions
                );
                const essayCount = normalizedQuestions.filter((question) => question.type === 'essay').length;
                return {
                    ...assessment,
                    id: assessment?.id || `${lesson.id}-assessment-${index + 1}`,
                    title: assessment?.title || `${lesson.title || 'Lesson'} Assessment`,
                    description: assessment?.description || (essayCount
                        ? 'Includes multiple-choice and essay questions for applied understanding.'
                        : 'Multiple-choice assessment based on the lesson content.'),
                    duration: assessment?.duration || estimateAssessmentDuration(normalizedQuestions),
                    totalQuestions: normalizedQuestions.length,
                    passingScore: Number.isFinite(Number(assessment?.passingScore))
                        ? Number(assessment.passingScore)
                        : (levelNumber >= 3 ? 80 : 70),
                    isDraft: assessment?.isDraft !== false,
                    questions: normalizedQuestions
                };
            });
        }

        const fallbackQuestions = legacyQuestions.length ? legacyQuestions : seedQuestions;
        return [createLessonAssessment(lesson.id, lesson.title, fallbackQuestions, levelNumber)];
    }

    function normalizeSlide(slide, seedSlide, lessonId, index) {
        const source = slide || seedSlide || {};
        return {
            ...source,
            id: source.id || `${lessonId}-slide-${index + 1}`,
            number: index + 1,
            title: source.title || `Slide ${index + 1}`,
            visualName: source.visualName || '',
            visualDataUrl: source.visualDataUrl || '',
            visualType: source.visualType || '',
            lessonText: source.lessonText || source.content || source.description || '',
            keyNotes: source.keyNotes || source.notes || '',
            mediaAssets: Array.isArray(source.mediaAssets) ? source.mediaAssets : [],
            scriptTimeline: Array.isArray(source.scriptTimeline) ? source.scriptTimeline : []
        };
    }

    function createPlaceholderSlides(lesson, lessonId, slideCount) {
        const count = Math.max(0, Number(slideCount) || 0);
        return Array.from({ length: count }, (_, index) => normalizeSlide({
            title: count === 1 ? (lesson?.title || 'Slide 1') : `Slide ${index + 1}`,
            lessonText: index === 0 ? (lesson?.lessonText || lesson?.content || '') : '',
            keyNotes: index === 0 ? (lesson?.keyNotes || lesson?.notes || '') : ''
        }, null, lessonId, index));
    }

    function normalizeLesson(lesson, seedLesson, levelNumber, lessonIndex, levelId) {
        const lessonId = lesson?.id || seedLesson?.id || `${levelId}-lesson-${lessonIndex + 1}`;
        const sourceSlides = Array.isArray(lesson?.slides) && lesson.slides.length
            ? lesson.slides
            : (Array.isArray(seedLesson?.slides) && seedLesson.slides.length ? seedLesson.slides : []);
        const legacySlideCount = countLessonSlides(lesson) || countLessonSlides(seedLesson);
        const normalizedSlides = sourceSlides.length
            ? sourceSlides.map((slide, index) => normalizeSlide(slide, seedLesson?.slides?.[index], lessonId, index))
            : createPlaceholderSlides(lesson, lessonId, legacySlideCount);
        const normalizedSlideCount = normalizedSlides.length;
        const lessonWithId = {
            ...lesson,
            id: lessonId
        };
        const normalizedAssessments = normalizeAssessments(lessonWithId, seedLesson, levelNumber);
        const primaryAssessmentQuestions = Array.isArray(normalizedAssessments[0]?.questions)
            ? clone(normalizedAssessments[0].questions)
            : [];
        return {
            ...lesson,
            id: lessonId,
            title: lesson?.title || seedLesson?.title || `Lesson ${lessonIndex + 1}`,
            subtitle: lesson?.subtitle || seedLesson?.subtitle || '',
            slides: normalizedSlides,
            slideCount: normalizedSlideCount,
            duration: formatSlidesLabel(normalizedSlideCount),
            assessments: normalizedAssessments,
            questions: primaryAssessmentQuestions
        };
    }

    function normalizeCourse(course) {
        const seedCourse = seedCourses.find((item) => item.id === course.id);
        const normalizedLevels = (course.levels || []).map((level, levelIndex) => {
            const seedLevel = seedCourse?.levels?.[levelIndex];
            const levelId = level?.id || seedLevel?.id || `${course.id || 'draft-course'}-level-${levelIndex + 1}`;
            const normalizedLessons = (level.lessons || []).map((lesson, lessonIndex) => {
                const seedLesson = seedLevel?.lessons?.[lessonIndex];
                return normalizeLesson(lesson, seedLesson, levelIndex + 1, lessonIndex, levelId);
            });

            return {
                ...level,
                id: levelId,
                title: level?.title || seedLevel?.title || `Level ${levelIndex + 1}`,
                description: level?.description || seedLevel?.description || '',
                price: Number.isFinite(Number(level?.price)) ? Number(level.price) : (seedLevel?.price || 0),
                lessons: normalizedLessons
            };
        });

        const derivedSlides = countCourseSlides({ ...course, levels: normalizedLevels });
        const seedSlides = seedCourse ? countCourseSlides(seedCourse) : 0;
        const totalSlides = derivedSlides || course.totalSlides || seedSlides || 0;

        return {
            ...course,
            id: course.id || '',
            title: course.title || '',
            creator: course.creator || 'Admin',
            description: course.description || '',
            thumbnail: course.thumbnail || '',
            thumbnailOriginalRef: course.thumbnailOriginalRef || '',
            thumbnailCrop: course.thumbnailCrop && typeof course.thumbnailCrop === 'object'
                ? {
                    zoom: Number.isFinite(Number(course.thumbnailCrop.zoom)) ? Number(course.thumbnailCrop.zoom) : 1,
                    centerX: Number.isFinite(Number(course.thumbnailCrop.centerX)) ? Number(course.thumbnailCrop.centerX) : 0.5,
                    centerY: Number.isFinite(Number(course.thumbnailCrop.centerY)) ? Number(course.thumbnailCrop.centerY) : 0.5
                }
                : null,
            badge: course.badge || 'New',
            rating: course.rating || '0.0',
            reviews: course.reviews || '0 reviews',
            students: course.students || '0',
            levels: normalizedLevels,
            totalSlides,
            duration: formatSlidesLabel(totalSlides),
            status: course.status === 'published' ? 'approved' : (course.status || 'draft')
        };
    }

    function ensurePublishedCourses() {
        const normalizedSeedCourses = seedCourses.map((course) => normalizeCourse(course));
        const current = readJson(PUBLISHED_KEY, null);

        if (!Array.isArray(current) || current.length === 0) {
            writeJson(PUBLISHED_KEY, clone(normalizedSeedCourses));
            return clone(normalizedSeedCourses);
        }

        const hasLegacySeedCourses = current.some((course) => LEGACY_SEED_IDS.includes(course.id));
        if (hasLegacySeedCourses) {
            const preservedCourses = current.filter((course) => !LEGACY_SEED_IDS.includes(course.id));
            const normalized = preservedCourses.map((course) => normalizeCourse(course)).concat(clone(normalizedSeedCourses));
            writeJson(PUBLISHED_KEY, normalized);
            return clone(normalized);
        }

        const hasCurrentSeedCourses = current.some((course) => CURRENT_SEED_IDS.includes(course.id));
        if (hasCurrentSeedCourses) {
            const preservedCourses = current.filter((course) => !CURRENT_SEED_IDS.includes(course.id));
            const refreshedSeedCourses = CURRENT_SEED_IDS.map((seedId) => {
                const seedCourse = normalizedSeedCourses.find((course) => course.id === seedId);
                const existingCourse = current.find((course) => course.id === seedId);

                if (!seedCourse) {
                    return null;
                }

                if (!existingCourse) {
                    return clone(seedCourse);
                }

                return normalizeCourse({
                    ...seedCourse,
                    ...existingCourse,
                    status: existingCourse.status,
                    levels: Array.isArray(existingCourse.levels) && existingCourse.levels.length
                        ? existingCourse.levels
                        : seedCourse.levels
                });
            }).filter(Boolean);

            const normalized = preservedCourses.map((course) => normalizeCourse(course)).concat(refreshedSeedCourses);
            writeJson(PUBLISHED_KEY, normalized);
            return clone(normalized);
        }

        const normalized = current.map((course) => normalizeCourse(course));
        writeJson(PUBLISHED_KEY, normalized);
        return normalized;
    }

    function getPublishedCourses() {
        return clone(ensurePublishedCourses());
    }

    function getApprovedCourses() {
        return getPublishedCourses().filter((course) => course.status === 'approved');
    }

    function getDraftCourses() {
        return getPublishedCourses().filter((course) => course.status !== 'approved');
    }

    function savePublishedCourses(courses) {
        writeJson(PUBLISHED_KEY, clone(courses));
        window.dispatchEvent(new CustomEvent(STORE_UPDATED_EVENT, {
            detail: {
                key: PUBLISHED_KEY,
                courses: clone(courses)
            }
        }));
    }

    function getCourseById(courseId) {
        return getPublishedCourses().find((course) => course.id === courseId) || null;
    }

    function upsertCourse(course) {
        const courses = getPublishedCourses();
        const normalized = normalizeCourse(clone(course));
        normalized.id = normalized.id || slugify(normalized.title);
        normalized.status = normalized.status || 'draft';

        const index = courses.findIndex((item) => item.id === normalized.id);
        if (index >= 0) {
            courses[index] = normalized;
        } else {
            courses.push(normalized);
        }

        savePublishedCourses(courses);
        return clone(normalized);
    }

    function deleteCourse(courseId) {
        const courses = getPublishedCourses().filter((course) => course.id !== courseId);
        savePublishedCourses(courses);
    }

    function setEditorDraft(draft) {
        writeJson(DRAFT_KEY, normalizeEditorDraft(draft));
    }

    function getEditorDraft() {
        const draft = readJson(DRAFT_KEY, null);
        if (!draft) {
            return null;
        }

        const normalized = normalizeEditorDraft(draft);
        if (JSON.stringify(draft) !== JSON.stringify(normalized)) {
            writeJson(DRAFT_KEY, normalized);
        }

        return normalized;
    }

    function clearEditorDraft() {
        localStorage.removeItem(DRAFT_KEY);
    }

    function createEmptyCourse() {
        return {
            id: '',
            title: '',
            creator: 'Admin',
            description: '',
            thumbnail: '',
            thumbnailOriginalRef: '',
            badge: 'New',
            rating: '0.0',
            reviews: '0 reviews',
            duration: '0 slides',
            students: '0',
            status: 'draft',
            levels: []
        };
    }

    function normalizeEditorDraft(draft) {
        if (!draft || typeof draft !== 'object') {
            return null;
        }

        return {
            ...draft,
            schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
            mode: draft.mode === 'edit' ? 'edit' : 'create',
            course: draft.course ? normalizeCourse(draft.course) : createEmptyCourse()
        };
    }

    window.SIMPCourseStore = {
        STORE_UPDATED_EVENT,
        clone,
        slugify,
        generateCourseId,
        getPublishedCourses,
        getApprovedCourses,
        getDraftCourses,
        savePublishedCourses,
        getCourseById,
        upsertCourse,
        deleteCourse,
        setEditorDraft,
        getEditorDraft,
        clearEditorDraft,
        createEmptyCourse
    };
})();
