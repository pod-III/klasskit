/* ============================================================================
   TENSE DIVER — DATA, 16-TENSE CURRICULUM, CONJUGATOR & COMPARE PAIRS
   Classic browser module exposing window.TenseDiverData
   ============================================================================ */
(function () {
    'use strict';

    const TENSE_GROUPS = [
        {
            color: 'green',
            label: 'Present',
            subtitle: 'Now, habits & present links',
            keys: ['presentSimple', 'presentCont', 'presentPerfect', 'presentPerfectCont']
        },
        {
            color: 'pink',
            label: 'Past',
            subtitle: 'Finished or ongoing before now',
            keys: ['pastSimple', 'pastCont', 'pastPerfect', 'pastPerfectCont']
        },
        {
            color: 'blue',
            label: 'Future',
            subtitle: 'Plans, predictions & future bounds',
            keys: ['futureSimple', 'futureCont', 'futurePerfect', 'futurePerfectCont']
        },
        {
            color: 'orange',
            label: 'Past Future',
            subtitle: 'Future in the past & conditionals',
            keys: ['pastFutureSimple', 'pastFutureCont', 'pastFuturePerfect', 'pastFuturePerfectCont']
        }
    ];

    const TENSE_ORDER = TENSE_GROUPS.reduce((acc, g) => acc.concat(g.keys), []);

    const TENSES = {
        /* ==================== PRESENT GROUP ==================== */
        presentSimple: {
            cat: 'Present',
            color: 'green',
            title: 'Simple Present',
            shortFormula: 'V1 (s/es)',
            desc: 'Used for facts, habits, daily routines, and fixed schedules that stay generally true.',
            formulas: {
                pos: 'S + V1 (s/es)',
                neg: 'S + do/does + not + V1',
                q: 'Do/Does + S + V1?'
            },
            examples: {
                pos: 'I play tennis every Sunday.',
                neg: 'I do not play tennis every Sunday.',
                q: 'Do you play tennis every Sunday?'
            },
            usage: [
                { title: 'Habits & Routines', detail: 'Actions that happen repeatedly or regularly over time.' },
                { title: 'General Truths & Facts', detail: 'Statements that are always true, like science or definitions.' },
                { title: 'Fixed Schedules', detail: 'Timetables for buses, classes, and public events.' }
            ],
            signals: ['every day', 'always', 'usually', 'often', 'never', 'on Sundays'],
            mistake: {
                wrong: 'She do not goes to school on Fridays.',
                right: 'She does not go to school on Fridays.',
                tip: 'After does/doesn\'t, the main verb returns to base V1 (drop -s/-es).'
            },
            viz: [
                { type: 'pin', l: 16, y: 46, label: 'Repeat', labelPos: 'top' },
                { type: 'pin', l: 34, y: 46, label: 'Repeat', labelPos: 'top' },
                { type: 'pin', l: 50, y: 46, label: 'Now', labelPos: 'top' },
                { type: 'pin', l: 68, y: 46, label: 'Repeat', labelPos: 'top' },
                { type: 'pin', l: 84, y: 46, label: 'Repeat', labelPos: 'top' },
                { type: 'range', l: 12, w: 76, y: 74, label: 'Routine / Always True', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'Choose the correct negative sentence in Simple Present:',
                    options: ['He does not likes coffee.', 'He does not like coffee.', 'He do not like coffee.'],
                    answer: 1,
                    explanation: 'With "He", use "does not" plus the base verb "like" (no -s).'
                },
                {
                    prompt: 'Which signal word best matches Simple Present habits?',
                    options: ['Yesterday', 'Usually', 'At 8 PM tomorrow'],
                    answer: 1,
                    explanation: '"Usually" marks repeated routines in Simple Present.'
                }
            ]
        },

        presentCont: {
            cat: 'Present',
            color: 'green',
            title: 'Present Continuous',
            shortFormula: 'am/is/are + V-ing',
            desc: 'Actions happening right now at this moment, or temporary situations around the present.',
            formulas: {
                pos: 'S + am/is/are + V-ing',
                neg: 'S + am/is/are + not + V-ing',
                q: 'Am/Is/Are + S + V-ing?'
            },
            examples: {
                pos: 'I am studying English right now.',
                neg: 'I am not studying English right now.',
                q: 'Are you studying English right now?'
            },
            usage: [
                { title: 'Happening Right Now', detail: 'Actions directly in progress at the moment of speaking.' },
                { title: 'Temporary Situations', detail: 'Short-term projects or stays happening these days or this week.' },
                { title: 'Arranged Near Future', detail: 'Confirmed personal plans with a fixed time or person.' }
            ],
            signals: ['now', 'right now', 'at the moment', 'Look!', 'Listen!', 'these days'],
            mistake: {
                wrong: 'They are play football in the yard right now.',
                right: 'They are playing football in the yard right now.',
                tip: 'Always pair am/is/are with the -ing participle (V-ing) for active actions.'
            },
            viz: [
                { type: 'range', l: 41, w: 18, y: 52, label: 'In Progress NOW', labelPos: 'bottom', active: true }
            ],
            quiz: [
                {
                    prompt: 'Look at the dark clouds! It ___ right now.',
                    options: ['rains', 'is raining', 'rained'],
                    answer: 1,
                    explanation: 'Happening right now uses is + V-ing ("is raining").'
                },
                {
                    prompt: 'How do we form a question in Present Continuous?',
                    options: ['Is she working now?', 'Does she working now?', 'She is working now?'],
                    answer: 0,
                    explanation: 'Invert am/is/are before the subject: "Is she working now?"'
                }
            ]
        },

        presentPerfect: {
            cat: 'Present',
            color: 'green',
            title: 'Present Perfect',
            shortFormula: 'have/has + V3',
            desc: 'Past actions or experiences with an unspecified time that connect directly to a present result.',
            formulas: {
                pos: 'S + have/has + V3',
                neg: 'S + have/has + not + V3',
                q: 'Have/Has + S + V3?'
            },
            examples: {
                pos: 'I have finished my homework already.',
                neg: 'I have not finished my homework yet.',
                q: 'Have you finished your homework yet?'
            },
            usage: [
                { title: 'Present Result', detail: 'An action finished earlier whose result matters right now.' },
                { title: 'Life Experiences', detail: 'Things you have or haven\'t done up to today (exact time unstated).' },
                { title: 'Unfinished Time Frame', detail: 'States starting in the past that still hold today.' }
            ],
            signals: ['already', 'just', 'yet', 'ever / never', 'since', 'for'],
            mistake: {
                wrong: 'I have saw that movie yesterday.',
                right: 'I saw that movie yesterday. / I have seen that movie.',
                tip: 'Use past participle V3 ("seen"), and avoid finished past time words like "yesterday".'
            },
            viz: [
                { type: 'pin', l: 28, y: 44, label: 'Done Earlier', labelPos: 'top' },
                { type: 'arrow', l: 28, w: 22, y: 66, label: 'Result affects NOW', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'Complete: "She ___ all three chapters yet." (negative)',
                    options: ['has not read', 'did not read', 'have not read'],
                    answer: 0,
                    explanation: 'With "She" and "yet", use "has not + V3" ("has not read").'
                },
                {
                    prompt: 'Which timeline matches Present Perfect?',
                    options: ['Pin in Past + Arrow pointing to NOW', 'Pin + Specific Time in Past', 'Range starting in Future'],
                    answer: 0,
                    explanation: 'Present Perfect links an earlier event with a present impact at NOW.'
                }
            ]
        },

        presentPerfectCont: {
            cat: 'Present',
            color: 'green',
            title: 'Present Perf. Cont.',
            shortFormula: 'have/has been + V-ing',
            desc: 'Activities that started in the past, continued through time, and are still going or just stopped.',
            formulas: {
                pos: 'S + have/has + been + V-ing',
                neg: 'S + have/has + not + been + V-ing',
                q: 'Have/Has + S + been + V-ing?'
            },
            examples: {
                pos: 'I have been waiting for two hours.',
                neg: 'I have not been waiting long.',
                q: 'Have you been waiting here long?'
            },
            usage: [
                { title: 'Ongoing Duration to Now', detail: 'Emphasizes how long an action has continued up to NOW.' },
                { title: 'Visible Present Clue', detail: 'Action just stopped, leaving evidence right now (e.g., tired or wet).' }
            ],
            signals: ['for 2 hours', 'since morning', 'all day', 'how long', 'lately'],
            mistake: {
                wrong: 'I am waiting here since 9 o\'clock.',
                right: 'I have been waiting here since 9 o\'clock.',
                tip: 'When measuring duration from past to NOW with since/for, use have/has been + V-ing.'
            },
            viz: [
                { type: 'range', l: 20, w: 30, y: 44, label: 'Started in Past', labelPos: 'top', active: true },
                { type: 'arrow', l: 20, w: 30, y: 68, label: 'Duration up to NOW', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'Why are your hands muddy? "I ___ in the garden all morning!"',
                    options: ['worked', 'have been working', 'will be working'],
                    answer: 1,
                    explanation: 'A recent ongoing activity leaving a visible clue now uses Present Perfect Continuous.'
                },
                {
                    prompt: 'Choose the right negative form for "They":',
                    options: ['They have been not studying.', 'They have not been studying.', 'They has not been studying.'],
                    answer: 1,
                    explanation: '"not" goes right after the first auxiliary: "have not been + V-ing".'
                }
            ]
        },

        /* ==================== PAST GROUP ==================== */
        pastSimple: {
            cat: 'Past',
            color: 'pink',
            title: 'Simple Past',
            shortFormula: 'V2 / did + V1',
            desc: 'Completed actions at a definite, finished time before now.',
            formulas: {
                pos: 'S + V2',
                neg: 'S + did + not + V1',
                q: 'Did + S + V1?'
            },
            examples: {
                pos: 'I visited Bali yesterday.',
                neg: 'I did not visit Bali yesterday.',
                q: 'Did you visit Bali yesterday?'
            },
            usage: [
                { title: 'Finished Past Action', detail: 'Single event completed at a known past time.' },
                { title: 'Sequence of Events', detail: 'Stories where one past action followed another.' },
                { title: 'Closed Past Habits', detail: 'Routines you did in the past that no longer happen.' }
            ],
            signals: ['yesterday', 'last week', 'in 2020', 'two days ago', 'then'],
            mistake: {
                wrong: 'Did you went to the library yesterday?',
                right: 'Did you go to the library yesterday?',
                tip: 'When "did" carries the past tense, the main verb drops back to base V1!'
            },
            viz: [
                { type: 'pin', l: 26, y: 44, label: 'Action Finished', labelPos: 'top' },
                { type: 'marker', l: 26, y: 74, label: 'Yesterday / Past Time', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'Pick the correct Simple Past question:',
                    options: ['Did she finished the test?', 'Did she finish the test?', 'Was she finish the test?'],
                    answer: 1,
                    explanation: 'Use "Did + subject + base V1": "Did she finish the test?"'
                },
                {
                    prompt: 'Which signal word locks a sentence to Simple Past?',
                    options: ['Last night', 'Already', 'Tomorrow'],
                    answer: 0,
                    explanation: '"Last night" marks a finished past point.'
                }
            ]
        },

        pastCont: {
            cat: 'Past',
            color: 'pink',
            title: 'Past Continuous',
            shortFormula: 'was/were + V-ing',
            desc: 'An action that was in progress at a specific moment in the past or interrupted by another event.',
            formulas: {
                pos: 'S + was/were + V-ing',
                neg: 'S + was/were + not + V-ing',
                q: 'Was/Were + S + V-ing?'
            },
            examples: {
                pos: 'I was sleeping when you called.',
                neg: 'I was not sleeping at 8 PM.',
                q: 'Were you sleeping when I called?'
            },
            usage: [
                { title: 'Interrupted Background Action', detail: 'Long action (was/were + V-ing) interrupted by a short Simple Past pin.' },
                { title: 'Exact Past Moment', detail: 'Action ongoing at a clock time like "at 8 PM yesterday".' },
                { title: 'Parallel Past Actions', detail: 'Two actions unfolding side by side connected with "while".' }
            ],
            signals: ['while', 'when', 'at 8 PM last night', 'all evening'],
            mistake: {
                wrong: 'We was watching a film when the lights went out.',
                right: 'We were watching a film when the lights went out.',
                tip: 'Use "were" with You/We/They and "was" with I/He/She/It.'
            },
            viz: [
                { type: 'range', l: 16, w: 22, y: 58, label: 'Was Doing...', labelPos: 'bottom' },
                { type: 'pin', l: 27, y: 34, label: 'Interruption (V2)', labelPos: 'top' }
            ],
            quiz: [
                {
                    prompt: 'While Anna ___ dinner, her phone rang.',
                    options: ['cooked', 'was cooking', 'had cooked'],
                    answer: 1,
                    explanation: 'The longer background action interrupted by "rang" uses Past Continuous ("was cooking").'
                },
                {
                    prompt: 'Which connector usually introduces the longer background action?',
                    options: ['While', 'By 2030', 'Since'],
                    answer: 0,
                    explanation: '"While" pairs naturally with an ongoing Past Continuous range.'
                }
            ]
        },

        pastPerfect: {
            cat: 'Past',
            color: 'pink',
            title: 'Past Perfect',
            shortFormula: 'had + V3',
            desc: 'The earlier of two past actions — "the past before the past".',
            formulas: {
                pos: 'S + had + V3',
                neg: 'S + had + not + V3',
                q: 'Had + S + V3?'
            },
            examples: {
                pos: 'She had left before I arrived.',
                neg: 'She had not left when I arrived.',
                q: 'Had she left before you arrived?'
            },
            usage: [
                { title: 'Earlier Past Event', detail: 'Clarifies which of two past actions finished first.' },
                { title: 'Cause Before Result', detail: 'Explains why a later past moment turned out the way it did.' }
            ],
            signals: ['before', 'after', 'by the time', 'already', 'until'],
            mistake: {
                wrong: 'The train already left when we reached the station.',
                right: 'The train had already left when we reached the station.',
                tip: 'Put "had + V3" on Event 1 (the earlier action) and V2 on Event 2.'
            },
            viz: [
                { type: 'pin', l: 16, y: 44, label: 'Event 1 (had V3)', labelPos: 'top' },
                { type: 'arrow', l: 16, w: 20, y: 66, label: 'Before Event 2', labelPos: 'bottom' },
                { type: 'pin', l: 36, y: 44, label: 'Event 2 (V2)', labelPos: 'top' }
            ],
            quiz: [
                {
                    prompt: 'Which action happened FIRST? "When I got home, Mom had made dinner."',
                    options: ['I got home', 'Mom made dinner', 'Both happened after NOW'],
                    answer: 1,
                    explanation: '"had made" (Past Perfect) always marks Event 1 before the Simple Past event.'
                },
                {
                    prompt: 'Choose the right form for negative Past Perfect:',
                    options: ['had not forgot', 'had not forgotten', 'did not had forgotten'],
                    answer: 1,
                    explanation: 'Negative Past Perfect uses "had not + V3" ("forgotten").'
                }
            ]
        },

        pastPerfectCont: {
            cat: 'Past',
            color: 'pink',
            title: 'Past Perf. Cont.',
            shortFormula: 'had been + V-ing',
            desc: 'An ongoing activity with duration leading right up to a second point in the past.',
            formulas: {
                pos: 'S + had + been + V-ing',
                neg: 'S + had + not + been + V-ing',
                q: 'Had + S + been + V-ing?'
            },
            examples: {
                pos: 'I had been running, so I was tired.',
                neg: 'I had not been running for long.',
                q: 'Had you been running before class?'
            },
            usage: [
                { title: 'Duration Before Past Event', detail: 'Shows how long an activity continued before Event 2 happened.' },
                { title: 'Visible Past Cause', detail: 'Explains a past condition like exhaustion or wet streets.' }
            ],
            signals: ['for', 'since', 'before', 'all day', 'when'],
            mistake: {
                wrong: 'She was tired because she was working for six hours.',
                right: 'She was tired because she had been working for six hours.',
                tip: 'Duration measured BEFORE a past moment requires "had been + V-ing".'
            },
            viz: [
                { type: 'range', l: 12, w: 24, y: 50, label: 'Duration Before', labelPos: 'bottom' },
                { type: 'pin', l: 36, y: 44, label: 'Past Event', labelPos: 'top' }
            ],
            quiz: [
                {
                    prompt: 'His eyes hurt because he ___ at the screen for hours.',
                    options: ['had been staring', 'is staring', 'will be staring'],
                    answer: 0,
                    explanation: 'Ongoing duration causing a past state uses "had been + V-ing".'
                },
                {
                    prompt: 'What is placed in the Builder right after the duration Range for this tense?',
                    options: ['A future Time Marker', 'A second past Event Pin', 'A ghost arrow into NOW'],
                    answer: 1,
                    explanation: 'The ongoing duration stretches across the past up to an Event Pin before NOW.'
                }
            ]
        },

        /* ==================== FUTURE GROUP ==================== */
        futureSimple: {
            cat: 'Future',
            color: 'blue',
            title: 'Simple Future',
            shortFormula: 'will + V1',
            desc: 'Decisions made right now, promises, offers, and predictions about what will happen later.',
            formulas: {
                pos: 'S + will + V1',
                neg: 'S + will + not + V1',
                q: 'Will + S + V1?'
            },
            examples: {
                pos: 'I will call you tomorrow.',
                neg: 'I will not forget your book.',
                q: 'Will you call me tomorrow?'
            },
            usage: [
                { title: 'Instant Decision', detail: 'Choices decided spontaneously at the moment of speaking.' },
                { title: 'Promises & Offers', detail: 'Volunteering to help or making a personal guarantee.' },
                { title: 'Predictions', detail: 'Expectations or opinions about the future.' }
            ],
            signals: ['tomorrow', 'next week', 'soon', 'tonight', 'I think'],
            mistake: {
                wrong: 'She will goes to Jakarta tomorrow.',
                right: 'She will go to Jakarta tomorrow.',
                tip: 'Never add -s, -ed, or "to" after "will" — always use base V1!'
            },
            viz: [
                { type: 'arrow', l: 50, w: 24, y: 66, label: 'Decision / Promise Now', labelPos: 'bottom' },
                { type: 'pin', l: 74, y: 46, label: 'Future Action', labelPos: 'top' }
            ],
            quiz: [
                {
                    prompt: 'The phone is ringing! "Don\'t worry, I ___ it."',
                    options: ['will answer', 'will answering', 'answered'],
                    answer: 0,
                    explanation: 'Spontaneous offers at NOW take "will + base V1".'
                },
                {
                    prompt: 'Which negative form is correct?',
                    options: ['I will not went tomorrow.', 'I won\'t go tomorrow.', 'I don\'t will go tomorrow.'],
                    answer: 1,
                    explanation: '"won\'t" (will not) + base V1 is the standard negative Simple Future.'
                }
            ]
        },

        futureCont: {
            cat: 'Future',
            color: 'blue',
            title: 'Future Continuous',
            shortFormula: 'will be + V-ing',
            desc: 'An action that will already be in progress around a specific time in the future.',
            formulas: {
                pos: 'S + will + be + V-ing',
                neg: 'S + will + not + be + V-ing',
                q: 'Will + S + be + V-ing?'
            },
            examples: {
                pos: 'I will be flying at 8 PM tomorrow.',
                neg: 'I will not be working at 8 PM.',
                q: 'Will you be flying at 8 PM tomorrow?'
            },
            usage: [
                { title: 'In Progress at Future Time', detail: 'Activity happening over a clock moment tomorrow or next week.' },
                { title: 'Polite Future Inquiry', detail: 'Asking softly about someone\'s plans without pressuring them.' }
            ],
            signals: ['at 8 PM tomorrow', 'this time next week', 'all morning tomorrow'],
            mistake: {
                wrong: 'At noon tomorrow, we will be eat lunch.',
                right: 'At noon tomorrow, we will be eating lunch.',
                tip: 'Future Continuous needs BOTH "be" and "-ing": will be + V-ing.'
            },
            viz: [
                { type: 'range', l: 64, w: 24, y: 48, label: 'Will Be Doing...', labelPos: 'top' },
                { type: 'marker', l: 76, y: 76, label: 'Future Point', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'This time next Friday, we ___ on the beach!',
                    options: ['will relax', 'will be relaxing', 'relaxed'],
                    answer: 1,
                    explanation: 'At a future checkpoint ("this time next Friday"), ongoing actions use "will be + V-ing".'
                },
                {
                    prompt: 'Choose the right negative structure:',
                    options: ['She won\'t be driving at 9 PM.', 'She will be not driving at 9 PM.', 'She won\'t driving at 9 PM.'],
                    answer: 0,
                    explanation: 'Place "not" after "will": "will not (won\'t) be + V-ing".'
                }
            ]
        },

        futurePerfect: {
            cat: 'Future',
            color: 'blue',
            title: 'Future Perfect',
            shortFormula: 'will have + V3',
            desc: 'Looking back from a future deadline at an action that will already be completed by then.',
            formulas: {
                pos: 'S + will + have + V3',
                neg: 'S + will + not + have + V3',
                q: 'Will + S + have + V3?'
            },
            examples: {
                pos: 'I will have finished by 5 PM.',
                neg: 'I will not have finished by 5 PM.',
                q: 'Will you have finished by 5 PM?'
            },
            usage: [
                { title: 'Completed Before a Deadline', detail: 'Finished before a future cutoff marked with "by" or "before".' }
            ],
            signals: ['by tomorrow', 'by 5 PM', 'by the time', 'before Monday'],
            mistake: {
                wrong: 'By 5 PM, she will has finished the report.',
                right: 'By 5 PM, she will have finished the report.',
                tip: 'After "will", always use "have" (even with He/She/It) — never "has"!'
            },
            viz: [
                { type: 'arrow', l: 50, w: 28, y: 62, label: 'Completed Before', labelPos: 'bottom' },
                { type: 'pin', l: 78, y: 42, label: 'Finished', labelPos: 'top' },
                { type: 'marker', l: 88, y: 76, label: 'By Deadline', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'By 2030, engineers ___ faster solar batteries.',
                    options: ['will have built', 'will be build', 'has built'],
                    answer: 0,
                    explanation: 'Completion before a future deadline ("By 2030") uses "will have + V3".'
                },
                {
                    prompt: 'Which preposition often signals Future Perfect?',
                    options: ['By', 'Yesterday', 'Ago'],
                    answer: 0,
                    explanation: '"By + future time" sets the deadline for completion.'
                }
            ]
        },

        futurePerfectCont: {
            cat: 'Future',
            color: 'blue',
            title: 'Future Perf. Cont.',
            shortFormula: 'will have been + V-ing',
            desc: 'Measures how long an activity will have continued when reaching a future milestone.',
            formulas: {
                pos: 'S + will + have + been + V-ing',
                neg: 'S + will + not + have + been + V-ing',
                q: 'Will + S + have + been + V-ing?'
            },
            examples: {
                pos: 'By May, I will have been teaching for ten years.',
                neg: 'By May, I will not have been living here a year.',
                q: 'Will you have been teaching for ten years by May?'
            },
            usage: [
                { title: 'Duration Up to Future Point', detail: 'Counts total hours, days, or years leading up to a future marker.' }
            ],
            signals: ['by next year ... for 5 years', 'by 5 PM ... for 3 hours'],
            mistake: {
                wrong: 'By Friday, we will have living here for two months.',
                right: 'By Friday, we will have been living here for two months.',
                tip: 'Don\'t forget "been" between "have" and "V-ing"!'
            },
            viz: [
                { type: 'range', l: 52, w: 36, y: 50, label: 'Ongoing Duration', labelPos: 'top' },
                { type: 'marker', l: 88, y: 76, label: 'Future Milestone', labelPos: 'bottom' }
            ],
            quiz: [
                {
                    prompt: 'By 6 PM, Maria ___ for four straight hours!',
                    options: ['will have been studying', 'will studying', 'had been studying'],
                    answer: 0,
                    explanation: 'Duration measured up to a future marker ("By 6 PM ... for four hours") uses Future Perfect Continuous.'
                },
                {
                    prompt: 'Select the right auxiliary chain:',
                    options: ['will + have + been + V-ing', 'will + has + been + V-ing', 'will + been + V-ing'],
                    answer: 0,
                    explanation: 'Always "will + have + been + V-ing" for every subject.'
                }
            ]
        },

        /* ==================== PAST FUTURE GROUP ==================== */
        pastFutureSimple: {
            cat: 'Past Future',
            color: 'orange',
            title: 'Past Future Simple',
            shortFormula: 'would + V1',
            desc: 'Plans or predictions looked ahead from a past viewpoint, plus Conditionals Type 2.',
            formulas: {
                pos: 'S + would + V1',
                neg: 'S + would + not + V1',
                q: 'Would + S + V1?'
            },
            examples: {
                pos: 'He said he would buy the ticket.',
                neg: 'He said he would not quit.',
                q: 'Would you buy that car if you won?'
            },
            usage: [
                { title: 'Future From Past View', detail: 'What someone predicted or promised earlier in reported speech.' },
                { title: 'Conditional Type 2', detail: 'Imaginary present/future results ("If I had wings, I would fly").' }
            ],
            signals: ['he said that...', 'the next day', 'if I were you'],
            mistake: {
                wrong: 'She promised she will help me yesterday.',
                right: 'She promised she would help me yesterday.',
                tip: 'When reporting a past promise ("promised", "said"), shift "will" back to "would".'
            },
            viz: [
                { type: 'pin', l: 16, y: 48, label: 'Said (Past)', labelPos: 'top' },
                { type: 'arrow', l: 16, w: 18, y: 66, label: 'Expected', labelPos: 'bottom', dashed: true },
                { type: 'pin', l: 34, y: 48, label: 'Would Do', labelPos: 'top', ghost: true }
            ],
            quiz: [
                {
                    prompt: 'Reported speech: "I will help." -> Tom said he ___ help.',
                    options: ['will', 'would', 'woulds'],
                    answer: 1,
                    explanation: 'In past reported speech, "will" shifts back to "would".'
                },
                {
                    prompt: 'Conditional 2: If I spoke fluent Japanese, I ___ in Tokyo.',
                    options: ['would work', 'will worked', 'would working'],
                    answer: 0,
                    explanation: 'Imaginary conditional outcomes use "would + base V1".'
                }
            ]
        },

        pastFutureCont: {
            cat: 'Past Future',
            color: 'orange',
            title: 'Past Future Cont.',
            shortFormula: 'would be + V-ing',
            desc: 'An action imagined or expected to be in progress at a time after a past starting point.',
            formulas: {
                pos: 'S + would + be + V-ing',
                neg: 'S + would + not + be + V-ing',
                q: 'Would + S + be + V-ing?'
            },
            examples: {
                pos: 'I thought I would be working today.',
                neg: 'She thought she would not be traveling.',
                q: 'Would you still be waiting at 10 PM?'
            },
            usage: [
                { title: 'Imagined Ongoing Action', detail: 'Continuing activity expected in reported speech or unreal scenarios.' }
            ],
            signals: ['I thought...', 'at that time', 'by then'],
            mistake: {
                wrong: 'I imagined we would relaxing right now.',
                right: 'I imagined we would be relaxing right now.',
                tip: 'Keep "be" right before V-ing after "would".'
            },
            viz: [
                { type: 'pin', l: 16, y: 48, label: 'Thought', labelPos: 'top' },
                { type: 'range', l: 28, w: 18, y: 60, label: 'Would Be Doing', labelPos: 'bottom', ghost: true }
            ],
            quiz: [
                {
                    prompt: 'Maya expected that by noon she ___ across the bridge.',
                    options: ['would be driving', 'will driving', 'had driven'],
                    answer: 0,
                    explanation: 'Ongoing action expected from a past thought uses "would be + V-ing".'
                },
                {
                    prompt: 'Choose the right negative form:',
                    options: ['would not be working', 'would be not working', 'not would be working'],
                    answer: 0,
                    explanation: 'Insert "not" directly after "would": "would not be + V-ing".'
                }
            ]
        },

        pastFuturePerfect: {
            cat: 'Past Future',
            color: 'orange',
            title: 'Past Future Perfect',
            shortFormula: 'would have + V3',
            desc: 'Unreal or missed past outcomes that did not actually happen (Conditional Type 3).',
            formulas: {
                pos: 'S + would + have + V3',
                neg: 'S + would + not + have + V3',
                q: 'Would + S + have + V3?'
            },
            examples: {
                pos: 'I would have helped if I had known.',
                neg: 'I would not have left so early.',
                q: 'Would you have come if we invited you?'
            },
            usage: [
                { title: 'Conditional Type 3 (Regrets)', detail: 'Imagining a different outcome for a finished past event.' }
            ],
            signals: ['if + had + V3', 'otherwise', 'without your help'],
            mistake: {
                wrong: 'If I had woken up early, I would not missed the bus.',
                right: 'If I had woken up early, I would not have missed the bus.',
                tip: 'Always include "have + V3" after "would" in Type 3 conditionals!'
            },
            viz: [
                { type: 'pin', l: 24, y: 46, label: 'Did NOT Happen', labelPos: 'top', cross: true },
                { type: 'arrow', l: 24, w: 16, y: 68, label: 'Unreal Outcome', labelPos: 'bottom', dashed: true }
            ],
            quiz: [
                {
                    prompt: 'If you had studied harder, you ___ the exam.',
                    options: ['would pass', 'would have passed', 'will have passed'],
                    answer: 1,
                    explanation: 'Past unreal Conditionals Type 3 pair "If + had V3" with "would have + V3".'
                },
                {
                    prompt: 'Does "I would have helped" mean you actually helped?',
                    options: ['Yes, I definitely helped.', 'No, it did not happen.', 'It is scheduled for tomorrow.'],
                    answer: 1,
                    explanation: 'Past Future Perfect describes an imagined past outcome that never occurred.'
                }
            ]
        },

        pastFuturePerfectCont: {
            cat: 'Past Future',
            color: 'orange',
            title: 'Past Future Perf. Cont.',
            shortFormula: 'would have been + V-ing',
            desc: 'Imagined ongoing duration in the past that never took place under different conditions.',
            formulas: {
                pos: 'S + would + have + been + V-ing',
                neg: 'S + would + not + have + been + V-ing',
                q: 'Would + S + have + been + V-ing?'
            },
            examples: {
                pos: 'If we hadn\'t caught the train, we would have been walking all afternoon.',
                neg: 'We would not have been waiting so long.',
                q: 'Would she have been practicing without a coach?'
            },
            usage: [
                { title: 'Imagined Past Duration', detail: 'Describes how long an unreal activity would have lasted in the past.' }
            ],
            signals: ['if + had V3', 'for hours', 'all afternoon'],
            mistake: {
                wrong: 'She would have sleeping if we hadn\'t called.',
                right: 'She would have been sleeping if we hadn\'t called.',
                tip: 'Keep all four parts in order: would + have + been + V-ing.'
            },
            viz: [
                { type: 'range', l: 18, w: 22, y: 52, label: 'Unreal Duration', labelPos: 'bottom', ghost: true, cross: true }
            ],
            quiz: [
                {
                    prompt: 'Without that shortcut, we ___ for hours in the rain!',
                    options: ['would have been walking', 'would walking', 'had been walking'],
                    answer: 0,
                    explanation: 'Unreal continuous duration in the past takes "would have been + V-ing".'
                },
                {
                    prompt: 'Pick the correct question form:',
                    options: ['Would you have been working then?', 'Would have you been working then?', 'Do you would have been working?'],
                    answer: 0,
                    explanation: 'Invert only the first modal before the subject: "Would + S + have been + V-ing?"'
                }
            ]
        }
    };

    const SUBJECTS = [
        { id: 'I', cap: 'I', low: 'I', thirdSg: false, bePres: 'am', bePast: 'was', doAux: 'do', haveAux: 'have' },
        { id: 'You', cap: 'You', low: 'you', thirdSg: false, bePres: 'are', bePast: 'were', doAux: 'do', haveAux: 'have' },
        { id: 'He', cap: 'He', low: 'he', thirdSg: true, bePres: 'is', bePast: 'was', doAux: 'does', haveAux: 'has' },
        { id: 'She', cap: 'She', low: 'she', thirdSg: true, bePres: 'is', bePast: 'was', doAux: 'does', haveAux: 'has' },
        { id: 'We', cap: 'We', low: 'we', thirdSg: false, bePres: 'are', bePast: 'were', doAux: 'do', haveAux: 'have' },
        { id: 'They', cap: 'They', low: 'they', thirdSg: false, bePres: 'are', bePast: 'were', doAux: 'do', haveAux: 'have' }
    ];

    const VERBS = [
        { id: 'play', label: 'play tennis', base: 'play', v1s: 'plays', v2: 'played', v3: 'played', ving: 'playing', obj: 'tennis' },
        { id: 'study', label: 'study English', base: 'study', v1s: 'studies', v2: 'studied', v3: 'studied', ving: 'studying', obj: 'English' },
        { id: 'eat', label: 'eat lunch', base: 'eat', v1s: 'eats', v2: 'ate', v3: 'eaten', ving: 'eating', obj: 'lunch' },
        { id: 'go', label: 'go home', base: 'go', v1s: 'goes', v2: 'went', v3: 'gone', ving: 'going', obj: 'home' },
        { id: 'write', label: 'write stories', base: 'write', v1s: 'writes', v2: 'wrote', v3: 'written', ving: 'writing', obj: 'stories' },
        { id: 'work', label: 'work hard', base: 'work', v1s: 'works', v2: 'worked', v3: 'worked', ving: 'working', obj: 'hard' }
    ];

    function capFirst(word) {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }

    function buildSentenceResult(parts) {
        const cleanParts = parts.filter((p) => p && p.text);
        const full = cleanParts.map((p) => p.text).join('');
        return { full, segments: cleanParts };
    }

    function conjugateTense(tenseKey, subjectId, verbId, form) {
        const s = SUBJECTS.find((x) => x.id === subjectId) || SUBJECTS[0];
        const v = VERBS.find((x) => x.id === verbId) || VERBS[0];
        const f = (form === 'neg' || form === 'q') ? form : 'pos';

        function assemble(aux1, verbHighlight, tail) {
            const endPunct = f === 'q' ? '?' : '.';
            const tailText = tail ? ` ${v.obj} ${tail}${endPunct}` : ` ${v.obj}${endPunct}`;
            if (f === 'q') {
                const segs = [{ text: `${capFirst(aux1)}`, highlight: true }, { text: ` ${s.low}`, highlight: false }];
                if (verbHighlight) segs.push({ text: ` ${verbHighlight}`, highlight: true });
                segs.push({ text: tailText, highlight: false });
                return buildSentenceResult(segs);
            }
            if (f === 'neg') {
                const phrase = verbHighlight ? `${aux1} not ${verbHighlight}` : `${aux1} not`;
                return buildSentenceResult([
                    { text: `${s.cap} `, highlight: false },
                    { text: phrase, highlight: true },
                    { text: tailText, highlight: false }
                ]);
            }
            const phrase = aux1 ? (verbHighlight ? `${aux1} ${verbHighlight}` : aux1) : verbHighlight;
            return buildSentenceResult([
                { text: `${s.cap} `, highlight: false },
                { text: phrase, highlight: true },
                { text: tailText, highlight: false }
            ]);
        }

        switch (tenseKey) {
            case 'presentSimple':
                if (f === 'pos') return assemble('', s.thirdSg ? v.v1s : v.base, 'every day');
                return assemble(s.doAux, v.base, 'every day');

            case 'presentCont':
                return assemble(s.bePres, v.ving, 'right now');

            case 'presentPerfect':
                return assemble(s.haveAux, v.v3, '');

            case 'presentPerfectCont':
                return assemble(s.haveAux, `been ${v.ving}`, 'for two hours');

            case 'pastSimple':
                if (f === 'pos') return assemble('', v.v2, 'yesterday');
                return assemble('did', v.base, 'yesterday');

            case 'pastCont':
                return assemble(s.bePast, v.ving, 'at 8 PM');

            case 'pastPerfect':
                return assemble('had', v.v3, 'before 6 PM');

            case 'pastPerfectCont':
                return assemble('had', `been ${v.ving}`, 'for hours');

            case 'futureSimple':
                return assemble('will', v.base, 'tomorrow');

            case 'futureCont':
                return assemble('will', `be ${v.ving}`, 'at 8 PM tomorrow');

            case 'futurePerfect':
                return assemble('will', `have ${v.v3}`, 'by 5 PM');

            case 'futurePerfectCont':
                return assemble('will', `have been ${v.ving}`, 'for hours by noon');

            case 'pastFutureSimple':
                return assemble('would', v.base, 'the next day');

            case 'pastFutureCont':
                return assemble('would', `be ${v.ving}`, 'at that time');

            case 'pastFuturePerfect':
                return assemble('would', `have ${v.v3}`, 'if possible');

            case 'pastFuturePerfectCont':
                return assemble('would', `have been ${v.ving}`, 'all afternoon');

            default:
                return assemble('', s.thirdSg ? v.v1s : v.base, 'every day');
        }
    }

    const COMPARE_PAIRS = [
        {
            id: 'past-vs-perf',
            label: 'Simple Past vs Present Perfect',
            left: 'pastSimple',
            right: 'presentPerfect',
            takeaway: 'Simple Past pins an action to a closed past time (yesterday, in 2020). Present Perfect drops the exact timestamp and highlights its arrow into NOW.'
        },
        {
            id: 'pres-vs-cont',
            label: 'Simple Present vs Present Cont.',
            left: 'presentSimple',
            right: 'presentCont',
            takeaway: 'Simple Present shows repeated routines and general facts across all time; Present Continuous zooms onto one glowing action happening right NOW.'
        },
        {
            id: 'past-vs-pcont',
            label: 'Simple Past vs Past Continuous',
            left: 'pastSimple',
            right: 'pastCont',
            takeaway: 'Simple Past is a single completed pin. Past Continuous sets a background activity range in progress when a short event interrupted it.'
        },
        {
            id: 'past-vs-pperf',
            label: 'Simple Past vs Past Perfect',
            left: 'pastSimple',
            right: 'pastPerfect',
            takeaway: 'Use Past Perfect (had + V3) when there are two past actions and you need to prove Event 1 finished before Event 2.'
        },
        {
            id: 'fut-vs-fperf',
            label: 'Simple Future vs Future Perfect',
            left: 'futureSimple',
            right: 'futurePerfect',
            takeaway: 'Simple Future describes an action happening at a future time; Future Perfect guarantees the action is already DONE before a future deadline.'
        },
        {
            id: 'pfut-vs-pfperf',
            label: 'Past Future vs Past Future Perf.',
            left: 'pastFutureSimple',
            right: 'pastFuturePerfect',
            takeaway: 'Past Future (would + V1) predicts ahead or forms Conditional Type 2, while Past Future Perfect (would have + V3) imagines unreal Type 3 past regrets.'
        }
    ];

    window.TenseDiverData = {
        TENSE_GROUPS,
        TENSE_ORDER,
        TENSES,
        SUBJECTS,
        VERBS,
        COMPARE_PAIRS,
        conjugateTense
    };
})();
