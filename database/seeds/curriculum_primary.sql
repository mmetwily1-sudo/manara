-- مناهج الابتدائي 1-6 (عام) — ترم أول وثانٍ (مضغوط: المواد الأساسية)
-- يتطلب ترحيل 004. آمن التكرار.

insert into curriculum_tracks (code,system,grade,grade_ar,stream,stream_ar,term,year) values
  ('moe-1prim-t1','moe','1prim','الأول الابتدائي',null,null,1,2026),
  ('moe-1prim-t2','moe','1prim','الأول الابتدائي',null,null,2,2026),
  ('moe-2prim-t1','moe','2prim','الثاني الابتدائي',null,null,1,2026),
  ('moe-2prim-t2','moe','2prim','الثاني الابتدائي',null,null,2,2026),
  ('moe-3prim-t1','moe','3prim','الثالث الابتدائي',null,null,1,2026),
  ('moe-3prim-t2','moe','3prim','الثالث الابتدائي',null,null,2,2026),
  ('moe-4prim-t1','moe','4prim','الرابع الابتدائي',null,null,1,2026),
  ('moe-4prim-t2','moe','4prim','الرابع الابتدائي',null,null,2,2026),
  ('moe-5prim-t1','moe','5prim','الخامس الابتدائي',null,null,1,2026),
  ('moe-5prim-t2','moe','5prim','الخامس الابتدائي',null,null,2,2026),
  ('moe-6prim-t1','moe','6prim','السادس الابتدائي',null,null,1,2026),
  ('moe-6prim-t2','moe','6prim','السادس الابتدائي',null,null,2,2026)
on conflict (code) do nothing;

-- ===== أولى ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-1prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'الحروف',1,'الحروف الهجائية والحركات','e1ar-u1-l1',30),
  ('لغة عربية',1,'الحروف',2,'المدود','e1ar-u1-l2',20),
  ('لغة عربية',2,'كلمات وجمل',1,'تكوين كلمات وجمل','e1ar-u2-l1',25),
  ('لغة عربية',2,'كلمات وجمل',2,'أناشيد وقصص قصيرة','e1ar-u2-l2',25),
  ('لغة إنجليزية',1,'الحروف والأرقام',1,'Letters and numbers','e1en-u1-l1',40),
  ('لغة إنجليزية',1,'الحروف والأرقام',2,'كلمات مصورة','e1en-u1-l2',30),
  ('لغة إنجليزية',2,'عبارات',1,'تحيات وأوامر','e1en-u2-l1',30),
  ('رياضيات',1,'الأعداد',1,'الأعداد حتى 100','e1m-u1-l1',35),
  ('رياضيات',1,'الأعداد',2,'الجمع والطرح','e1m-u1-l2',35),
  ('رياضيات',2,'الأشكال',1,'الأشكال الهندسية','e1m-u2-l1',30),
  ('اكتشف',1,'أنا وبيئتي',1,'جسمي وحواسي','e1d-u1-l1',35),
  ('اكتشف',1,'أنا وبيئتي',2,'بيتي ومدرستي','e1d-u1-l2',35),
  ('اكتشف',2,'الكون',1,'الليل والنهار والفصول','e1d-u2-l1',30),
  ('تربية دينية',1,'القرآن والآداب',1,'قصار السور','e1r-u1-l1',40),
  ('تربية دينية',1,'القرآن والآداب',2,'آداب وسيرة مبسطة','e1r-u1-l2',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-1prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'الظواهر',1,'التنوين','e1ar2-u1-l1',25),
  ('لغة عربية',1,'الظواهر',2,'الشدة واللام الشمسية والقمرية','e1ar2-u1-l2',25),
  ('لغة عربية',2,'نصوص',1,'دروس وقصص الترم الثاني','e1ar2-u2-l1',25),
  ('لغة عربية',2,'نصوص',2,'التعبير الشفوي','e1ar2-u2-l2',25),
  ('لغة إنجليزية',1,'المفردات',1,'العائلة والألوان','e1en2-u1-l1',40),
  ('لغة إنجليزية',2,'المحادثة',1,'محادثات قصيرة','e1en2-u2-l1',30),
  ('رياضيات',1,'العمليات',1,'جمع وطرح متقدم','e1m2-u1-l1',35),
  ('رياضيات',2,'القياس',1,'الطول والوقت والنقود','e1m2-u2-l1',35),
  ('اكتشف',1,'المجتمع',1,'المهن والخدمات','e1d2-u1-l1',35),
  ('اكتشف',2,'الطبيعة',1,'الحيوانات والنباتات','e1d2-u2-l1',35),
  ('تربية دينية',1,'القرآن والآداب',1,'سور جديدة وآداب','e1r2-u1-l1',40)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== تانية ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-2prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'الظواهر اللغوية',1,'المدود والتنوين','e2ar-u1-l1',25),
  ('لغة عربية',1,'الظواهر اللغوية',2,'أسماء الإشارة والضمائر','e2ar-u1-l2',25),
  ('لغة عربية',2,'الدروس',1,'دروس وقصص الترم الأول','e2ar-u2-l1',25),
  ('لغة عربية',2,'الدروس',2,'الأناشيد','e2ar-u2-l2',25),
  ('لغة إنجليزية',1,'المفردات',1,'المدرسة والجسم','e2en-u1-l1',40),
  ('لغة إنجليزية',2,'القواعد',1,'المضارع البسيط','e2en-u2-l1',30),
  ('رياضيات',1,'الأعداد الكبيرة',1,'الأعداد حتى 1000','e2m-u1-l1',35),
  ('رياضيات',1,'الأعداد الكبيرة',2,'الجمع والطرح بالاستلاف','e2m-u1-l2',35),
  ('رياضيات',2,'الهندسة',1,'المجسمات والأنماط','e2m-u2-l1',30),
  ('اكتشف',1,'البيئة',1,'الماء والهواء','e2d-u1-l1',35),
  ('اكتشف',2,'المجتمع',1,'المحافظات والآثار','e2d-u2-l1',35),
  ('تربية دينية',1,'القرآن والسيرة',1,'حفظ وتفسير مختارات','e2r-u1-l1',40)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-2prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'الأساليب',1,'أسلوب النفي والاستفهام','e2ar2-u1-l1',25),
  ('لغة عربية',2,'الدروس',1,'دروس وقصص الترم الثاني','e2ar2-u2-l1',25),
  ('لغة عربية',2,'الدروس',2,'التعبير الكتابي المبسط','e2ar2-u2-l2',25),
  ('لغة إنجليزية',1,'المفردات',1,'الطعام والحيوانات','e2en2-u1-l1',40),
  ('لغة إنجليزية',2,'المحادثة',1,'مواقف يومية','e2en2-u2-l1',30),
  ('رياضيات',1,'الضرب',1,'جدول الضرب','e2m2-u1-l1',40),
  ('رياضيات',2,'القسمة والكسور',1,'القسمة والكسور المبسطة','e2m2-u2-l1',30),
  ('اكتشف',1,'الطاقة',1,'الشمس والطاقة','e2d2-u1-l1',35),
  ('اكتشف',2,'الأرض',1,'الصخور والتربة','e2d2-u2-l1',35),
  ('تربية دينية',1,'القرآن والسيرة',1,'سور جديدة وسيرة','e2r2-u1-l1',40)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== تالتة ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-3prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو المبسط',1,'الجملة الاسمية والفعلية','e3ar-u1-l1',25),
  ('لغة عربية',1,'النحو المبسط',2,'حروف الجر والعطف','e3ar-u1-l2',20),
  ('لغة عربية',2,'الدروس',1,'دروس وقصص الترم الأول','e3ar-u2-l1',25),
  ('لغة عربية',2,'الدروس',2,'الأناشيد والتعبير','e3ar-u2-l2',30),
  ('لغة إنجليزية',1,'المفردات والقواعد',1,'الوحدات الأولى','e3en-u1-l1',40),
  ('لغة إنجليزية',2,'المهارات',1,'قراءة وكتابة','e3en-u2-l1',30),
  ('رياضيات',1,'الأعداد والعمليات',1,'الأعداد حتى 10000','e3m-u1-l1',30),
  ('رياضيات',1,'الأعداد والعمليات',2,'الضرب والقسمة','e3m-u1-l2',30),
  ('رياضيات',2,'الهندسة والقياس',1,'المحيط والمساحة','e3m-u2-l1',25),
  ('اكتشف',1,'الإنسان والبيئة',1,'أجهزة الجسم','e3d-u1-l1',35),
  ('اكتشف',2,'المادة',1,'حالات المادة','e3d-u2-l1',35),
  ('تربية دينية',1,'القرآن والسيرة',1,'حفظ وتفسير مختارات','e3r-u1-l1',40)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-3prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو المبسط',1,'الأفعال والأزمنة','e3ar2-u1-l1',25),
  ('لغة عربية',2,'الدروس',1,'دروس وقصص الترم الثاني','e3ar2-u2-l1',25),
  ('لغة عربية',2,'الدروس',2,'الإملاء والتعبير','e3ar2-u2-l2',25),
  ('لغة إنجليزية',1,'المفردات والقواعد',1,'الوحدات الأخيرة','e3en2-u1-l1',40),
  ('لغة إنجليزية',2,'القصة',1,'القصة المصورة','e3en2-u2-l1',30),
  ('رياضيات',1,'الكسور',1,'الكسور والكسور العشرية','e3m2-u1-l1',35),
  ('رياضيات',2,'القياس',1,'الوقت والكتلة والسعة','e3m2-u2-l1',35),
  ('اكتشف',1,'الكون',1,'الأرض والقمر','e3d2-u1-l1',35),
  ('اكتشف',2,'التكنولوجيا',1,'الآلات البسيطة','e3d2-u2-l1',35),
  ('تربية دينية',1,'القرآن والسيرة',1,'سور جديدة وسيرة','e3r2-u1-l1',40)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== رابعة ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-4prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'الجملة الاسمية والفعلية','e4ar-u1-l1',20),
  ('لغة عربية',1,'النحو',2,'المثنى','e4ar-u1-l2',15),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الأول','e4ar-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'القصة','e4ar-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 1-3',1,'قواعد ومفردات','e4en-u1-l1',35),
  ('لغة إنجليزية',2,'المهارات',1,'قراءة وكتابة','e4en-u2-l1',25),
  ('رياضيات',1,'الأعداد الكبيرة',1,'الملايين والعمليات','e4m-u1-l1',25),
  ('رياضيات',1,'الأعداد الكبيرة',2,'العوامل والمضاعفات','e4m-u1-l2',20),
  ('رياضيات',2,'الهندسة',1,'المستقيمات والزوايا','e4m-u2-l1',20),
  ('علوم',1,'الكائنات',1,'التكيف والبقاء','e4s-u1-l1',25),
  ('علوم',1,'الكائنات',2,'السلاسل الغذائية','e4s-u1-l2',20),
  ('علوم',2,'الطاقة',1,'الطاقة والحركة','e4s-u2-l1',20),
  ('دراسات اجتماعية',1,'الجغرافيا',1,'مصر وموقعها','e4d-u1-l1',25),
  ('دراسات اجتماعية',2,'التاريخ',1,'مصر الفرعونية (جزء أول)','e4d-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'حفظ وتفسير مختارات','e4r-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-4prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'جمع المذكر والمؤنث','e4ar2-u1-l1',20),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الثاني','e4ar2-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'التعبير والإملاء','e4ar2-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 4-6',1,'قواعد ومفردات','e4en2-u1-l1',35),
  ('لغة إنجليزية',2,'القصة',1,'القصة المقررة','e4en2-u2-l1',25),
  ('رياضيات',1,'الكسور',1,'الكسور الاعتيادية','e4m2-u1-l1',25),
  ('رياضيات',1,'الكسور',2,'الكسور العشرية','e4m2-u1-l2',20),
  ('رياضيات',2,'القياس',1,'المحيط والمساحة والحجوم','e4m2-u2-l1',20),
  ('علوم',1,'الأرض',1,'الصخور والتربة','e4s2-u1-l1',25),
  ('علوم',1,'الأرض',2,'الماء والهواء','e4s2-u1-l2',20),
  ('دراسات اجتماعية',1,'التاريخ',1,'مصر الفرعونية (جزء ثان)','e4d2-u1-l1',25),
  ('دراسات اجتماعية',2,'الجغرافيا',1,'الأنشطة الاقتصادية','e4d2-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'سور جديدة وسيرة','e4r2-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== خامسة ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-5prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'إعراب المبتدأ والخبر','e5ar-u1-l1',20),
  ('لغة عربية',1,'النحو',2,'الأفعال الناسخة','e5ar-u1-l2',15),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الأول','e5ar-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'القصة','e5ar-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 1-3',1,'قواعد ومفردات','e5en-u1-l1',35),
  ('لغة إنجليزية',2,'المهارات',1,'قراءة وكتابة','e5en-u2-l1',25),
  ('رياضيات',1,'الأعداد',1,'القسمة المطولة','e5m-u1-l1',25),
  ('رياضيات',1,'الأعداد',2,'المعادلات البسيطة','e5m-u1-l2',20),
  ('رياضيات',2,'الهندسة',1,'المثلثات والدوائر','e5m-u2-l1',20),
  ('علوم',1,'النبات',1,'أجزاء النبات ووظائفها','e5s-u1-l1',25),
  ('علوم',1,'النبات',2,'التكاثر في النبات','e5s-u1-l2',20),
  ('علوم',2,'الإنسان',1,'الجهاز الهضمي','e5s-u2-l1',20),
  ('دراسات اجتماعية',1,'التاريخ',1,'العصر القبطي والإسلامي','e5d-u1-l1',25),
  ('دراسات اجتماعية',2,'الجغرافيا',1,'المناخ والسكان','e5d-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'حفظ وتفسير مختارات','e5r-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-5prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'المفعول به','e5ar2-u1-l1',20),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الثاني','e5ar2-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'التعبير والإملاء','e5ar2-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 4-6',1,'قواعد ومفردات','e5en2-u1-l1',35),
  ('لغة إنجليزية',2,'القصة',1,'القصة المقررة','e5en2-u2-l1',25),
  ('رياضيات',1,'الكسور والنسب',1,'النسبة والتناسب','e5m2-u1-l1',25),
  ('رياضيات',2,'القياس',1,'الحجوم والسعة','e5m2-u2-l1',20),
  ('علوم',1,'المادة',1,'العناصر والمركبات','e5s2-u1-l1',25),
  ('علوم',1,'المادة',2,'المخاليط','e5s2-u1-l2',20),
  ('دراسات اجتماعية',1,'التاريخ',1,'العصر الحديث','e5d2-u1-l1',25),
  ('دراسات اجتماعية',2,'الجغرافيا',1,'الموارد الاقتصادية','e5d2-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'سور جديدة وسيرة','e5r2-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== سادسة ابتدائي =====
with t as (select id from curriculum_tracks where code='moe-6prim-t1')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'النواسخ','e6ar-u1-l1',20),
  ('لغة عربية',1,'النحو',2,'المفعول المطلق والحال','e6ar-u1-l2',15),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الأول','e6ar-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'القصة','e6ar-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 1-3',1,'قواعد ومفردات','e6en-u1-l1',35),
  ('لغة إنجليزية',2,'المهارات',1,'قراءة وكتابة','e6en-u2-l1',25),
  ('رياضيات',1,'النسبة',1,'النسبة والتناسب','e6m-u1-l1',25),
  ('رياضيات',1,'النسبة',2,'النسبة المئوية','e6m-u1-l2',20),
  ('رياضيات',2,'الهندسة',1,'المنشور والمكعب','e6m-u2-l1',20),
  ('علوم',1,'الكتلة والوزن',1,'الكتلة والوزن والكثافة','e6s-u1-l1',25),
  ('علوم',1,'الكتلة والوزن',2,'الاحتكاك','e6s-u1-l2',20),
  ('علوم',2,'الطاقة',1,'الطاقة الكهربية','e6s-u2-l1',20),
  ('دراسات اجتماعية',1,'التاريخ',1,'الحملة الفرنسية ومحمد علي (مبسط)','e6d-u1-l1',25),
  ('دراسات اجتماعية',2,'الجغرافيا',1,'سكان مصر','e6d-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'حفظ وتفسير مختارات','e6r-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code='moe-6prim-t2')
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('لغة عربية',1,'النحو',1,'التمييز والتوابع','e6ar2-u1-l1',20),
  ('لغة عربية',2,'النصوص والقراءة',1,'نصوص وقراءة الترم الثاني','e6ar2-u2-l1',25),
  ('لغة عربية',2,'النصوص والقراءة',2,'التعبير والإملاء','e6ar2-u2-l2',15),
  ('لغة إنجليزية',1,'الوحدات 4-6',1,'قواعد ومفردات','e6en2-u1-l1',35),
  ('لغة إنجليزية',2,'القصة',1,'القصة المقررة','e6en2-u2-l1',25),
  ('رياضيات',1,'الإحصاء',1,'التمثيل البياني','e6m2-u1-l1',25),
  ('رياضيات',1,'الإحصاء',2,'الاحتمال المبسط','e6m2-u1-l2',20),
  ('علوم',1,'البيئة',1,'التلوث وحماية البيئة','e6s2-u1-l1',25),
  ('علوم',1,'البيئة',2,'الوراثة المبسطة','e6s2-u1-l2',20),
  ('دراسات اجتماعية',1,'التاريخ',1,'ثورة 1919 ويوليو (مبسط)','e6d2-u1-l1',25),
  ('دراسات اجتماعية',2,'الجغرافيا',1,'الأنشطة الاقتصادية','e6d2-u2-l1',20),
  ('تربية دينية',1,'القرآن والسيرة',1,'سور جديدة وسيرة','e6r2-u1-l1',30)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== كتب الابتدائي =====
with t as (select id, code from curriculum_tracks)
insert into curriculum_books (track_id,subject,name)
select t.id, v.subject, v.name from t cross join (values
  ('moe-1prim-t1','لغة عربية','سلاح التلميذ'),('moe-1prim-t1','رياضيات','الأضواء'),
  ('moe-1prim-t1','لغة إنجليزية','المعاصر'),('moe-4prim-t1','لغة عربية','سلاح التلميذ'),
  ('moe-4prim-t1','رياضيات','الأضواء'),('moe-4prim-t1','علوم','الامتحان'),
  ('moe-4prim-t1','دراسات اجتماعية','الامتحان'),('moe-4prim-t1','لغة إنجليزية','المعاصر'),
  ('moe-6prim-t1','لغة عربية','سلاح التلميذ'),('moe-6prim-t1','رياضيات','الأضواء'),
  ('moe-6prim-t1','علوم','الامتحان'),('moe-6prim-t1','لغة إنجليزية','Gem')
) as v(track,subject,name)
where t.code = v.track
on conflict do nothing;
