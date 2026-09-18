-- مناهج الأزهر (ابتدائي خفيف + إعدادي + ثانوي) — المواد الشرعية والعربية فقط
-- المواد العلمية والثقافية مطابقة للعام: استخدم مسارات moe لنفس الصف
-- يتطلب ترحيل 004. آمن التكرار.

insert into curriculum_tracks (code,system,grade,grade_ar,stream,stream_ar,term,year) values
  ('azhar-1prim-t1','azhar','1prim','الأول الابتدائي',null,null,1,2026),
  ('azhar-1prim-t2','azhar','1prim','الأول الابتدائي',null,null,2,2026),
  ('azhar-2prim-t1','azhar','2prim','الثاني الابتدائي',null,null,1,2026),
  ('azhar-2prim-t2','azhar','2prim','الثاني الابتدائي',null,null,2,2026),
  ('azhar-3prim-t1','azhar','3prim','الثالث الابتدائي',null,null,1,2026),
  ('azhar-3prim-t2','azhar','3prim','الثالث الابتدائي',null,null,2,2026),
  ('azhar-4prim-t1','azhar','4prim','الرابع الابتدائي',null,null,1,2026),
  ('azhar-4prim-t2','azhar','4prim','الرابع الابتدائي',null,null,2,2026),
  ('azhar-5prim-t1','azhar','5prim','الخامس الابتدائي',null,null,1,2026),
  ('azhar-5prim-t2','azhar','5prim','الخامس الابتدائي',null,null,2,2026),
  ('azhar-6prim-t1','azhar','6prim','السادس الابتدائي',null,null,1,2026),
  ('azhar-6prim-t2','azhar','6prim','السادس الابتدائي',null,null,2,2026),
  ('azhar-1prep-t1','azhar','1prep','الأول الإعدادي',null,null,1,2026),
  ('azhar-1prep-t2','azhar','1prep','الأول الإعدادي',null,null,2,2026),
  ('azhar-2prep-t1','azhar','2prep','الثاني الإعدادي',null,null,1,2026),
  ('azhar-2prep-t2','azhar','2prep','الثاني الإعدادي',null,null,2,2026),
  ('azhar-3prep-t1','azhar','3prep','الثالث الإعدادي',null,null,1,2026),
  ('azhar-3prep-t2','azhar','3prep','الثالث الإعدادي',null,null,2,2026),
  ('azhar-1sec-t1','azhar','1sec','الأول الثانوي',null,null,1,2026),
  ('azhar-1sec-t2','azhar','1sec','الأول الثانوي',null,null,2,2026),
  ('azhar-2sec-sci-t1','azhar','2sec','الثاني الثانوي','sci','علمي',1,2026),
  ('azhar-2sec-sci-t2','azhar','2sec','الثاني الثانوي','sci','علمي',2,2026),
  ('azhar-2sec-lit-t1','azhar','2sec','الثاني الثانوي','lit','أدبي',1,2026),
  ('azhar-2sec-lit-t2','azhar','2sec','الثاني الثانوي','lit','أدبي',2,2026)
on conflict (code) do nothing;

-- ===== قرآن ابتدائي أزهر (نموذج موحد 1-6 بترميه: جزء عم ثم تبارك) =====
with t as (select id from curriculum_tracks where code in ('azhar-1prim-t1','azhar-2prim-t1','azhar-3prim-t1'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('القرآن الكريم',1,'الحفظ (ترم أول)',1,'سور جزء عم (أول)','azpq-u1-l1',40),
  ('القرآن الكريم',1,'الحفظ (ترم أول)',2,'سور جزء عم (ثان)','azpq-u1-l2',30),
  ('القرآن الكريم',2,'التجويد المبسط',1,'النون الساكنة والميم','azpq-u2-l1',30),
  ('تربية دينية',1,'السيرة والآداب',1,'سيرة مبسطة وآداب','azpr-u1-l1',35),
  ('تربية دينية',1,'السيرة والآداب',2,'عبادات مبسطة','azpr-u1-l2',35)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code in ('azhar-1prim-t2','azhar-2prim-t2','azhar-3prim-t2'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('القرآن الكريم',1,'الحفظ (ترم ثان)',1,'مراجعة جزء عم','azpq2-u1-l1',40),
  ('القرآن الكريم',1,'الحفظ (ترم ثان)',2,'سور جديدة','azpq2-u1-l2',30),
  ('القرآن الكريم',2,'التجويد المبسط',1,'المدود','azpq2-u2-l1',30),
  ('تربية دينية',1,'السيرة والآداب',1,'غزوات وصحابة','azpr2-u1-l1',35),
  ('تربية دينية',1,'السيرة والآداب',2,'أخلاق ومعاملات','azpr2-u1-l2',35)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code in ('azhar-4prim-t1','azhar-5prim-t1','azhar-6prim-t1'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('القرآن الكريم',1,'الحفظ (ترم أول)',1,'جزء تبارك (أول)','azpq3-u1-l1',40),
  ('القرآن الكريم',1,'الحفظ (ترم أول)',2,'جزء تبارك (ثان)','azpq3-u1-l2',30),
  ('القرآن الكريم',2,'التجويد',1,'أحكام النون والميم والمدود','azpq3-u2-l1',30),
  ('تربية دينية',1,'الفقه المبسط',1,'الطهارة والصلاة','azpr3-u1-l1',35),
  ('تربية دينية',1,'الفقه المبسط',2,'السيرة','azpr3-u1-l2',35)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code in ('azhar-4prim-t2','azhar-5prim-t2','azhar-6prim-t2'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('القرآن الكريم',1,'الحفظ (ترم ثان)',1,'مراجعة تبارك','azpq4-u1-l1',40),
  ('القرآن الكريم',1,'الحفظ (ترم ثان)',2,'جزء قد سمع (مختارات)','azpq4-u1-l2',30),
  ('القرآن الكريم',2,'التجويد',1,'مراجعة الأحكام','azpq4-u2-l1',30),
  ('تربية دينية',1,'الفقه المبسط',1,'الزكاة والصوم','azpr4-u1-l1',35),
  ('تربية دينية',1,'الفقه المبسط',2,'الأخلاق','azpr4-u1-l2',35)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== شرعي إعدادي أزهر =====
with t as (select id from curriculum_tracks where code in ('azhar-1prep-t1','azhar-2prep-t1','azhar-3prep-t1'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('الفقه',1,'الطهارة',1,'الوضوء والغسل','azpf-u1-l1',20),
  ('الفقه',1,'الطهارة',2,'التيمم والمسح','azpf-u1-l2',15),
  ('الفقه',2,'الصلاة',1,'أركان الصلاة','azpf-u2-l1',20),
  ('التوحيد',1,'مقدمات',1,'الإيمان وأركانه','azpt-u1-l1',20),
  ('التوحيد',1,'مقدمات',2,'صفات الله','azpt-u1-l2',15),
  ('التفسير',1,'جزء عم',1,'تفسير مختارات','azptf-u1-l1',20),
  ('الحديث',1,'مختارات',1,'حفظ وشرح أحاديث','azph-u1-l1',20),
  ('القرآن الكريم',1,'الحفظ',1,'المقرر (ترم أول)','azpq5-u1-l1',40),
  ('النحو',1,'الآجرومية',1,'الكلام والإعراب','azpn-u1-l1',20),
  ('النحو',1,'الآجرومية',2,'المعرب والمبني','azpn-u1-l2',15),
  ('الصرف',1,'الميزان',1,'الميزان الصرفي','azps-u1-l1',15)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code in ('azhar-1prep-t2','azhar-2prep-t2','azhar-3prep-t2'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('الفقه',1,'الصلاة',1,'الجمعة والعيدان','azpf2-u1-l1',20),
  ('الفقه',2,'الزكاة والصوم',1,'أحكام الزكاة والصوم','azpf2-u2-l1',20),
  ('التوحيد',1,'الأنبياء',1,'عصمة الأنبياء','azpt2-u1-l1',20),
  ('التفسير',1,'جزء تبارك',1,'تفسير مختارات','azptf2-u1-l1',20),
  ('الحديث',1,'مختارات',1,'حفظ وشرح أحاديث','azph2-u1-l1',20),
  ('القرآن الكريم',1,'الحفظ',1,'المقرر (ترم ثان)','azpq6-u1-l1',40),
  ('النحو',1,'الآجرومية',1,'النكرة والمعرفة','azpn2-u1-l1',20),
  ('الصرف',1,'الاشتقاق',1,'المصادر والمشتقات','azps2-u1-l1',15),
  ('البلاغة',1,'البيان',1,'التشبيه والاستعارة','azpb-u1-l1',15)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== شرعي ثانوي أزهر (1ث + 2ث علمي/أدبي) =====
with t as (select id from curriculum_tracks where code in ('azhar-1sec-t1','azhar-2sec-sci-t1','azhar-2sec-lit-t1'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('الفقه',1,'العبادات',1,'الطهارة والصلاة','azsf-u1-l1',20),
  ('الفقه',1,'العبادات',2,'الزكاة والصوم','azsf-u1-l2',16),
  ('التوحيد',1,'العقيدة',1,'الصفات والأنبياء','azst-u1-l1',20),
  ('التفسير',1,'المقرر',1,'تفسير الجزء المقرر','azstf-u1-l1',20),
  ('الحديث',1,'المقرر',1,'حفظ وشرح الأحاديث','azsh-u1-l1',20),
  ('القرآن الكريم',1,'الحفظ',1,'المقرر (ترم أول)','azsq-u1-l1',36),
  ('النحو',1,'النحو',1,'الجمل والإعراب','azsn-u1-l1',18),
  ('الصرف',1,'الصرف',1,'الميزان والاشتقاق','azss-u1-l1',14),
  ('البلاغة والأدب',1,'البلاغة',1,'علوم البلاغة والنصوص','azsb-u1-l1',16)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

with t as (select id from curriculum_tracks where code in ('azhar-1sec-t2','azhar-2sec-sci-t2','azhar-2sec-lit-t2'))
insert into curriculum_lessons (track_id,subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
select t.id, v.subject, v.unit_no, v.unit_title, v.lesson_no, v.lesson_title, v.code, v.weight
from t cross join (values
  ('الفقه',1,'العبادات',1,'الحج والعمرة','azsf2-u1-l1',20),
  ('الفقه',2,'المعاملات',1,'البيع والنكاح','azsf2-u2-l1',16),
  ('التوحيد',1,'العقيدة',1,'السمعيات والقدر','azst2-u1-l1',20),
  ('التفسير',1,'المقرر',1,'تفسير الجزء المقرر','azstf2-u1-l1',20),
  ('الحديث',1,'المقرر',1,'حفظ وشرح ومصطلح','azsh2-u1-l1',20),
  ('القرآن الكريم',1,'الحفظ',1,'المقرر (ترم ثان)','azsq2-u1-l1',36),
  ('النحو',1,'النحو',2,'التوابع والإعراب التطبيقي','azsn2-u1-l1',18),
  ('البلاغة والأدب',1,'الأدب',1,'الأدب عبر العصور','azsb2-u1-l1',16)
) as v(subject,unit_no,unit_title,lesson_no,lesson_title,code,weight)
on conflict do nothing;

-- ===== كتب الأزهر =====
with t as (select id, code from curriculum_tracks)
insert into curriculum_books (track_id,subject,name)
select t.id, v.subject, v.name from t cross join (values
  ('azhar-1prep-t1','الفقه','الإمام'),('azhar-1prep-t1','التوحيد','الإمام'),
  ('azhar-1prep-t1','النحو','المرشد'),('azhar-1prep-t1','القرآن الكريم','المرشد'),
  ('azhar-1sec-t1','الفقه','الإمام'),('azhar-1sec-t1','التوحيد','الإمام'),
  ('azhar-1sec-t1','التفسير','المرشد'),('azhar-1sec-t1','الحديث','المرشد'),
  ('azhar-1prim-t1','القرآن الكريم','المرشد')
) as v(track,subject,name)
where t.code = v.track
on conflict do nothing;
