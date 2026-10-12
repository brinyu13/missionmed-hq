<?php
/** Pure isolated session reducer. No WordPress globals or Drills state. */
final class MMED_IVPrep_Arena_State {
    public static function fail($message,$code=422) { throw new RuntimeException($message,$code); }
    public static function uuid($v) { return is_string($v) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$v); }
    public static function create($id,$class,$roster,$actor,$label) {
        if(!self::uuid($id)||!$class||!$actor||!is_string($label)||strlen($label)>120) self::fail('Invalid session.');
        if(!$roster||count($roster)>500)self::fail('Roster unavailable or too large.');
        $students=[];foreach($roster as $r){$key=(string)$r['id'];if(!ctype_digit($key)||strlen($r['name'])>160)self::fail('Invalid roster.');$students[$key]=['id'=>$key,'name'=>$r['name'],'present'=>false,'points'=>0,'team'=>(count($students)%2?'red':'blue')];}
        return ['id'=>$id,'class_id'=>(string)$class,'label'=>$label,'created_by'=>$actor,'created_at'=>gmdate('c'),'version'=>0,'students'=>$students,'selected'=>null,'active'=>null,'attempts'=>[],'events'=>[],'requests'=>[]];
    }
    public static function apply($s,$cmd,$actor) {
        if(!is_array($cmd)||!self::uuid($cmd['request_id']??null)||!is_int($cmd['version']??null)||!$actor)self::fail('Invalid command.');
        $rid=$cmd['request_id'];$canonical=$cmd;unset($canonical['version']);ksort($canonical);$fingerprint=hash('sha256',json_encode([$actor,$canonical],JSON_UNESCAPED_SLASHES));
        if(isset($s['requests'][$rid])){if($s['requests'][$rid]!==$fingerprint)self::fail('Request ID reused with different content.',409);return $s;}
        if($s['version']!==$cmd['version'])self::fail('Session changed. Reload before trying again.',409);
        if(count($s['events'])>=5000)self::fail('Session event limit reached. Start another session.');
        $type=$cmd['type']??'';$student=(string)($cmd['student_id']??$s['selected']??'');$attempt=$cmd['attempt_id']??null;
        $event=['id'=>$rid,'type'=>$type,'actor'=>$actor,'class_id'=>$s['class_id'],'session_id'=>$s['id'],'student_id'=>$student,'at'=>gmdate('c')];
        if(in_array($type,['attendance','select','start','team'],true)&&!isset($s['students'][$student]))self::fail('Student is not in this session roster.');
        if(in_array($type,['attendance','select','team','meeting','review','award','undo'],true)&&$s['active'])self::fail('End the active interview first.',409);
        switch($type){
            case 'meeting':
                $link=$cmd['url']??'';$parts=is_string($link)?parse_url($link):false;
                if(strlen($link)>2048||!$parts||($parts['scheme']??'')!=='https'||!preg_match('/(^|\.)webex\.com$/i',$parts['host']??'')||isset($parts['user'])||isset($parts['pass'])||isset($parts['port']))self::fail('Use an HTTPS Webex meeting link.');
                $s['meeting_url']=$link;$event['student_id']='';break;
            case 'team':
                if(!in_array($cmd['team']??'',['blue','red'],true))self::fail('Choose Blue or Red.');
                $s['students'][$student]['team']=$cmd['team'];$event['team']=$cmd['team'];break;
            case 'attendance':
                if(!is_bool($cmd['present']??null))self::fail('Attendance must be confirmed explicitly.');
                $s['students'][$student]['present']=$cmd['present'];$event['present']=$cmd['present'];if(!$cmd['present']&&$s['selected']===$student)$s['selected']=null;break;
            case 'select':
                if(!$s['students'][$student]['present'])self::fail('Confirm attendance before selecting.');$s['selected']=$student;break;
            case 'start':
                if($s['active']||$s['selected']!==$student||!$s['students'][$student]['present'])self::fail('Select a present student; end any active interview first.',409);
                if(!self::uuid($attempt)||isset($s['attempts'][$attempt]))self::fail('Invalid or reused interview ID.');
                $question=$cmd['question']??'';if(!is_string($question)||strlen($question)>1000)self::fail('Question is too long.');
                $s['attempts'][$attempt]=['id'=>$attempt,'student_id'=>$student,'question'=>$question,'started_at'=>gmdate('c'),'status'=>'recording','reviewed'=>false,'awarded'=>null];$s['active']=$attempt;$event['attempt_id']=$attempt;break;
            case 'finish':
                if(!$attempt||$s['active']!==$attempt)self::fail('This interview is not active.',409);
                $a=&$s['attempts'][$attempt];$status=$cmd['status']??'';
                if(!in_array($status,['finalized','interrupted','failed'],true))self::fail('Invalid recording result.');
                foreach(['bytes','duration','finalize_ms'] as $field)if(!is_int($cmd[$field]??null)||$cmd[$field]<0)self::fail('Invalid recording metadata.');
                if($status==='finalized'&&$cmd['bytes']===0)self::fail('Empty recording cannot be finalized.');
                $hash=$cmd['sha256']??'';if($status==='finalized'&&!preg_match('/^[a-f0-9]{64}$/D',$hash))self::fail('Recording fingerprint is required.');
                $a['status']=$status;$a['ended_at']=gmdate('c');$a['media']=['bytes'=>$cmd['bytes'],'duration'=>$cmd['duration'],'finalize_ms'=>$cmd['finalize_ms'],'sha256'=>$hash,'custody'=>'local_file_required'];
                $event['student_id']=$a['student_id'];$event['attempt_id']=$attempt;$event['status']=$status;$s['active']=null;unset($a);break;
            case 'review':
                if(!isset($s['attempts'][$attempt])||$s['attempts'][$attempt]['status']!=='finalized'||($cmd['both_voices_and_video']??false)!==true)self::fail('Verify finalized video and both voices before review.');
                $s['attempts'][$attempt]['reviewed']=true;$event['student_id']=$s['attempts'][$attempt]['student_id'];$event['attempt_id']=$attempt;break;
            case 'award':
                if(!isset($s['attempts'][$attempt])||!$s['attempts'][$attempt]['reviewed'])self::fail('Review this recording before awarding points.');
                $a=&$s['attempts'][$attempt];if($a['awarded'])self::fail('This interview is already scored. Undo its award first.',409);
                if(!is_int($cmd['points']??null)||$cmd['points']<0||$cmd['points']>10)self::fail('Award an integer from 0 to 10.');
                $student=$a['student_id'];$s['students'][$student]['points']+=$cmd['points'];$a['awarded']=$rid;$event['student_id']=$student;$event['points']=$cmd['points'];$event['attempt_id']=$attempt;$event['question']=$a['question'];unset($a);break;
            case 'undo':
                $original=$cmd['award_id']??'';$found=null;foreach($s['events'] as $e)if($e['id']===$original&&$e['type']==='award')$found=$e;
                if(!$found||$s['attempts'][$found['attempt_id']]['awarded']!==$original)self::fail('Award unavailable or already reversed.',409);
                $s['students'][$found['student_id']]['points']-=$found['points'];$s['attempts'][$found['attempt_id']]['awarded']=null;$event['student_id']=$found['student_id'];$event['award_id']=$original;$event['points']=-$found['points'];$event['attempt_id']=$found['attempt_id'];break;
            default:self::fail('Unknown command.');
        }
        $s['version']++;$s['events'][]=$event;$s['requests'][$rid]=$fingerprint;return $s;
    }
    public static function public_state($s) {unset($s['requests']);return $s;}
}
