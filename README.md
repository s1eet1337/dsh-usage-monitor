# dsh-usage-monitor

澶氭ā鍨嬬敤閲忎笌浣欓鐩戞帶 鈥斺€?涓€涓潰鍚?DeepSeek Harness锛圖SH锛?*Web GUI** 鐨?Bundle 鎻掍欢銆?
Multi-provider usage & balance monitor for the DeepSeek Harness web GUI. Provider 浣欓閫傞厤鍣ㄨ鐩?**DeepSeek / OpenAI / Anthropic / 鏅鸿氨 GLM / Moonshot(Kimi) / SiliconFlow**锛涚敤閲忕粺璁″熀浜?DSH 鑷韩浼氳瘽鏃ュ織锛涘甫棰勭畻杩涘害銆佷綆浣欓鍛婅锛堣姱鐗囩孩鐐?+ 寮圭獥 + Webhook锛変笌 CSV 瀵煎嚭銆?
> 鏈彃浠剁殑褰㈡€佷笌浠ｇ爜椋庢牸鍙傝€冧簡绀惧尯宸插彂甯冩彃浠讹細[dsh-usage-blance](https://github.com/zhou-yihang/dsh-usage-blance)銆乕@cassius0924/dsh-usage-dashboard](https://github.com/Cassius0924/dsh-usage-dashboard)銆乕GeekRicardo/dsh-balance](https://github.com/GeekRicardo/dsh-balance) 涓?DSH 鎻掍欢寮€鍙戞枃妗ｏ紝骞?*鍦ㄦ湰鏈?harness 0.1.5-rc.2 鐨勭湡瀹炴湇鍔?鎻掓Ы娓呭崟涓婃牳瀵硅繃 API**锛堣涓嬫柟銆屼笌鐜板疄 API 鐨勫榻愩€嶏級銆?
---

## 鍔熻兘

| 鍖哄煙 | 璇存槑 |
| --- | --- |
| 姒傝闈㈡澘 | 姣忎釜 Provider 涓€寮犲崱鐗囷細Logo銆佷綑棰濓紙甯﹁揣甯佺鍙凤級銆佷粖鏃?Token锛坕n/out 鍒嗗紑锛夈€侀绠楀崰鐢ㄨ繘搴︽潯銆佺姸鎬侊紙姝ｅ父/缂?Key/鏃犱綑棰濇帴鍙?閿欒锛夈€傚叆鍙ｏ細渚ц竟鏍忓簳閮ㄣ€岀敤閲忕洃鎺с€嶆寜閽?鎴?浼氳瘽椤舵爮浣欓鑺墖銆?|
| 鐢ㄩ噺鏄庣粏 | Provider / 妯″瀷 / 7路30路90 澶?绛涢€変笅鎷夛紱姣忔棩 Token 瓒嬪娍鎶樼嚎鍥撅紙绾?SVG锛夛紱鏄庣粏琛ㄦ寜銆屾棩鏈?脳 Provider 脳 妯″瀷銆嶆垨銆屾寜浼氳瘽銆嶅睍绀猴紙杈撳叆/杈撳嚭/缂撳瓨/鎬?Token銆佷及绠楄姳璐广€佹鏁般€佷細璇濇暟/鎿嶄綔浼氳瘽锛夛紱涓€閿鍑哄綋鍓嶇瓫閫夌粨鏋?CSV銆?|
| 椤舵爮浣欓鑺墖 | `conversation.session.header.utilities` 鍐呯殑浣欓鑳跺泭锛氳窡闅忓綋鍓嶆ā鍨嬫墍灞?Provider锛涗綆浜庨绠楅璀︾嚎鏃跺彉绾㈠苟鍦ㄥ渾鐐逛笂闂儊锛涚偣鍑绘墦寮€闈㈡澘銆?|
| 棰勭畻涓庡憡璀?| 姣忎釜 Provider 鍙棰勭畻閲戦 + 棰勮鐧惧垎姣旓紙榛樿 **浣欓 鈮?棰勭畻 5%** 鍛婅锛夈€傝繘鍏?warn/critical 鏃讹細鍙充笂瑙掑脊绐楁彁绀?+ 鑺墖/渚ф爮绾㈢偣锛涘悓鏃?host 渚у悜閰嶇疆鐨?**Webhook** 鎺ㄩ€侊紙鍙€?HMAC-SHA256 绛惧悕锛夈€?|
| 鏁版嵁 | 鐢ㄩ噺鏉ヨ嚜 DSH 鏈湴浼氳瘽鏃ュ織锛坄sessionPersistence` 鍥炴斁 `request/header` + `assistant/message`锛夛紝淇濈暀绐楀彛榛樿 90 澶╋紙鍙厤 7鈥?30锛夈€傞厤缃寔涔呭寲鍦?`$DSH_HOME/storages/dsh-usage-monitor/config.json`銆?|

## 蹇€熷畨瑁咃紙棰勬瀯寤哄寘锛?
浠撳簱宸插寘鍚瀯寤轰骇鐗?`lib/index.js`锛坔ost锛? `lib/client.js`锛堟祻瑙堝櫒 bundle锛夛紝鏃犻渶鍦ㄥ畨瑁呬晶缂栬瘧锛?
```sh
# 1) 瀹夎鍒?web profile锛堢洰褰曘€乬it 鍦板潃鎴?npm 鍖呭悕鍧囧彲锛?dsh plugin --profile web add /缁濆/璺緞/to/dsh-usage-monitor

# 2) 閲嶅惎 DSH web锛坆undle 灞傚湪鍚姩鏃惰鍙栵紱dsh plugin add 鍚庨渶閲嶅惎 profile锛?dsh web

# 3) 鎵撳紑 http://127.0.0.1:3080 骞跺埛鏂伴〉闈?```

涔熷彲浠ョ敤鎵撳寘濂界殑 tarball锛歚dsh plugin --profile web add ./dsh-usage-monitor-0.1.0.tgz`锛坄npm pack` 鐢熸垚锛岃鏂囨湯锛夈€傛墜鍔ㄦ柟寮忥細鎶婂寘鏀惧叆 profile 鐨?`node_modules`锛屽苟鍦?`~/.dsh/profiles/<profile>/cordis.patch.yml`锛堟闈㈢増涓?`$DSH_HOME/profiles/<profile>/cordis.patch.yml`锛夎拷鍔狅細

```yaml
- insert:
    - id: dsh-usage-monitor
      name: 'dsh-usage-monitor'
```

鍗歌浇锛歚dsh plugin --profile web remove dsh-usage-monitor`锛堟垨浠?`dsh.profile.bundles` 涓庝緷璧栦腑绉婚櫎鍚庨噸鍚級銆?
> 鍏充簬銆?bundle.js銆嶏細DSH 鐢熸€佹病鏈?`.bundle.js` 绾﹀畾锛涗竴涓?**bundle 鎻掍欢 = 澹版槑浜?`dsh.bundle` 鐨?npm 鍖呯洰褰?*锛坄package.json` + `lib/` + `cordis.patch.yml`锛夛紝`dsh plugin add` 璇嗗埆璇ュ０鏄庡苟鍐欏叆 profile 鐨?bundle 灞傘€傛湰鐩綍鍗充负璇ュ寘褰㈡€侊紝`npm pack` 鍙緱鍒板彲鍒嗗彂 tarball銆?
## 閰嶇疆

### API Key锛堢粷涓嶅瓨鍌?涓婁紶锛屼粎璇诲彇锛?
浼樺厛椤哄簭锛?*DSH credentials 鏈嶅姟**锛?銆岃缃?鈫?妯″瀷銆嶉噷濉啓鐨勫嚟璇侊紝鎻掍欢閫氳繃 `credentials.resolve(name)` 璇诲彇锛夆啋 杩涚▼鐜鍙橀噺銆傞粯璁ゅ悕绉帮細

| Provider | 璇诲彇鐨勫嚟璇?鐜鍙橀噺 |
| --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| 鏅鸿氨 GLM | `ZHIPUAI_API_KEY` / `GLM_API_KEY` / `ZAI_API_KEY`锛堜緷娆″皾璇曪級 |
| Moonshot / Kimi | `MOONSHOT_API_KEY` / `KIMI_API_KEY` |
| SiliconFlow | `SILICONFLOW_API_KEY` |

濡傞渶瑕嗙洊锛屽彲鍦ㄩ厤缃?`envKeys` 鎸囧畾鍏跺畠鍚嶇О锛屾垨鍦?settings UI 鍙皟棰勭畻/闃堝€笺€?
### 棰勭畻/鍛婅/Webhook

闈㈡澘銆岄绠椾笌鍛婅銆嶉〉鍙锛氭瘡 Provider 鏄惁鐩戞帶銆侀绠楅噾棰濓紙涓庤 Provider 浣欓鍚屽竵绉嶏級銆侀璀︾櫨鍒嗘瘮锛沇ebhook 鍒楄〃锛圲RL + 鍙€?Secret锛夈€備繚瀛樺悗鍐欏叆 `config.json`锛堟湰鏈猴級銆傜瓑浠风殑琛岄厤缃紙`cordis.patch.yml`锛夛細

```yaml
- insert:
    - id: dsh-usage-monitor
      name: 'dsh-usage-monitor'
      config:
        storageDir: '~/.dsh/storages/dsh-usage-monitor'
        balances:
          deepseek: { budget: 200, warnPct: 5, enabled: true }
          siliconflow: { budget: 50, warnPct: 10 }
        retentionDays: 90
        webhooks:
          - url: 'https://example.com/hook'
            secret: '鍙€夌鍚嶅瘑閽?
            enabled: true
        envKeys: { deepseek: 'MY_CUSTOM_ENV_NAME' }
        pricing:
          - { provider: 'zhipu', model: 'glm-4', priceIn: 1, priceOut: 1 }
```

Webhook 瑙﹀彂锛歅rovider 浣欓**杩涘叆** warn/critical锛堟垨 warn鈫抍ritical锛夋椂 POST JSON锛?
```json
{ "event": "balance-low", "provider": "deepseek", "label": "DeepSeek", "level": "warn",
  "at": 1760000000000, "balance": { "amount": 8.5, "currency": "CNY" },
  "budget": { "amount": 200, "currency": "CNY", "warnPct": 5 }, "remainingPct": 0.0425,
  "message": "DeepSeek 浣欓浣庝簬棰勭畻鐨?5%锛堝墿浣?4%锛? }
```

閰嶇疆浜?`secret` 鏃惰姹傚ご `x-dsh-usage-monitor-signature: sha256=<hmac-hex>`锛圚MAC-SHA256 over raw body锛夈€?
## 鏈湴 HTTP API锛坔ost 渚э紝鍚屾簮/鍥炵幆鐧藉悕鍗曪級

| 璺敱 | 璇存槑 |
| --- | --- |
| `GET /plugins/dsh-usage-monitor/overview[?refresh=1]` | 鍏?Provider 浣欓 + 浠婃棩鐢ㄩ噺 + 棰勭畻/鍛婅瑙嗗浘锛堜綑棰?60s銆佺敤閲?5min memo锛?|
| `GET /plugins/dsh-usage-monitor/usage?days=7|30|90&provider=&model=&group=day|session[&refresh=1]` | 鏄庣粏鑱氬悎锛堣〃鏍艰 + 姣忔棩搴忓垪 + 妯″瀷娓呭崟锛?|
| `GET /plugins/dsh-usage-monitor/export?鈥 | 褰撳墠绛涢€夌殑 CSV锛堝甫 UTF-8 BOM锛宍Content-Disposition: attachment`锛?|
| `GET/POST /plugins/dsh-usage-monitor/config` | 璇诲啓閰嶇疆锛沇ebhook Secret 姘镐笉鍥炰紶锛圙ET 鏃剁疆绌猴紝POST 鐣欑┖=淇濈暀鍘熷€硷級 |

娴忚鍣?UI 鍚屾簮 fetch 杩欎簺璺敱锛涙墍鏈夊搷搴斿甫 `Cache-Control`锛岃法婧?闈炲洖鐜姹傝繑鍥?403銆?
## 鏀寔 Provider 鐨勪綑棰濈湡瀹炴€э紙閲嶈锛?
| Provider | 琛屼负 | 渚濇嵁 |
| --- | --- | --- |
| DeepSeek | `GET api.deepseek.com/user/balance`锛岀湡浣欓锛圕NY锛?| [瀹樻柟鎺ュ彛](https://api-docs.deepseek.com/zh-cn/api/get-user-balance) |
| SiliconFlow | `GET api.siliconflow.cn/v1/user/info` 鈫?`data.totalBalance`锛圕NY锛沗.com` 绔欒嚜鍔?USD锛?| 绀惧尯/瀹樻柟鏂囨。 |
| 鏅鸿氨 GLM | `GET open.bigmodel.cn/api/paas/v4/balance`锛屽閿欒В鏋愬绉嶅搷搴旂粨鏋勶紙CNY锛?| 绀惧尯楠岃瘉 |
| OpenAI | 瀹樻柟宸插仠鐢?API Key 鐨?`credit_grants` 浣欓鏌ヨ锛堝鏁版柊璐﹀彿 401/404锛夆啋 浣欓**榛樿涓嶅彲鐢?*锛堟彁绀?+ 鍏佽閰嶇疆浣欓浠ｇ悊鍦板潃锛夛紱Key 鏈夋晥鎬ц蛋 `GET /v1/models` | 骞冲彴鏀跨瓥 |
| Anthropic | API Key 鏃犲叕寮€浣欓鎺ュ彛锛堢粍缁?Admin API 闇€鐙珛鏉冮檺锛夆啋 **鏃犱綑棰濇帴鍙?*锛汯ey 鏈夋晥鎬ц蛋 `GET /v1/models` | [鏂囨。](https://docs.anthropic.com/en/api/admin-api/usage-costs) |
| Moonshot / Kimi | 鏅€?API Key 鏆傛棤鍏紑绋冲畾鐨勪綑棰濇煡璇紙瀹樻柟鎺у埗鍙版煡鐪嬶紱Kimi 璁㈤槄鐢ㄩ噺鎺ュ彛灞炲彟涓€鍑嵁浣撶郴锛夆啋 **鏃犱綑棰濇帴鍙?*锛汯ey 鏈夋晥鎬ц蛋 `GET /v1/models` | [瀹樻柟璇存槑](https://www.kimi.com/en/help/kimi-api/api-balance-and-usage) |

鏃犱綑棰濇帴鍙ｇ殑 Provider锛氬崱鐗囦細鏄庣ず鍘熷洜銆佸彲鐓у父缁熻浼氳瘽鏃ュ織鐢ㄩ噺锛涜嫢璁剧疆浜嗛绠楋紝浼氶€€鍖栦负銆岄绠?鈭?鏈湀浼扮畻鑺辫垂銆嶆帹绠楀墿浣欏苟瑙﹀彂鍛婅锛堜及绠楄涓嬶級銆?
**鐢ㄩ噺鍙ｅ緞**锛氭墍鏈?Provider 鐨?Token/娆℃暟/瓒嬪娍閮芥潵鑷?DSH 鏈湴浼氳瘽鏃ュ織锛岃€岄潪鍘傚晢鐢ㄩ噺 API锛堝鏁颁笉鍚?API Key 寮€鏀撅級銆傘€岃姳璐广€嶆槸**鍙傝€冧环浼扮畻**锛堝唴缃叕寮€浠风洰 USD/1M锛岃 `src/core/pricing.ts`锛屽彲琚厤缃鐩栵級锛?*涓嶆槸璐﹀崟**銆傛墍鏈?API 璇锋眰锛氳秴鏃?5s銆佹渶澶氶噸璇?3 娆★紙鎸囨暟閫€閬匡紝429/5xx 閲嶈瘯锛夈€?
## 涓庣幇瀹?API 鐨勫榻愶紙鐩稿甯歌銆岃鏍艰鎯炽€嶇殑鍋忓樊锛?
寮€鍙戝墠鍏堟牳瀵逛簡**鏈満鐪熷疄杩愯鏃?*锛坔arness 0.1.2-alpha.1銆丏SH Desktop锛夌殑 Service/Event/Slot 娓呭崟涓庡凡瀹夎鎻掍欢鐨勬簮鐮侊細

1. **娌℃湁 `ctx.database`锛堥€氱敤 SQLite 鏈嶅姟锛?*銆傚巻鍙叉暟鎹殑鎸佷箙婧愭槸 DSH 鑷繁鐨勪細璇濇棩蹇楋紙`sessionPersistence`锛孞SONL/zstd 钀界洏锛夛紱鏈彃浠跺洖鏀惧畠鍋氱粺璁★紝骞舵妸**鎻掍欢鑷韩閰嶇疆**瀛樹负 `<DSH_HOME>/storages/dsh-usage-monitor/config.json`锛堜笌 `dsh-usage-blance` 鍚岀害瀹氾級銆?0 澶╀繚鐣欓€氳繃 `retentionDays` 鎺у埗銆?2. **娌℃湁 `model:update` 浜嬩欢**銆傚綋鍓嶆ā鍨嬬粡 host 鐨?`agentDefaultModel.currentSelection()` 璇诲彇锛堝彲閫夋湇鍔★紝鍙栦笉鍒板垯鏄剧ず鍏ㄩ儴 Provider锛夛紱銆屽垏鎹㈠嵆鍒锋柊銆嶇敱 client 杞 + host `session/event` 缂撳瓨澶辨晥瀹炵幇銆?3. **鏃犲叏灞€銆岄《鏍忋€嶇嫭鍗犳彃妲?*銆傛寜鐪熷疄鎻掓Ы鏍戯細浣欓鑺墖鏀?`conversation.session.header.utilities`锛堜細璇濋《鏍忓彸渚у伐鍏峰尯锛夛紝鍏ュ彛鎸夐挳鏀?`sidebar.footer.action`锛堜晶杈规爮搴曢儴鍔ㄤ綔浣嶏紝鏈€瀹夊叏鐨勫彲鍔犱綅锛夛紝闈㈡澘/寮圭獥鏀?`shell.overlay`锛堝叏灞忔诞灞傦級銆俙conversation.input.dock`锛堣緭鍏ユ涓婃柟锛寀sage-blance 鐢級涔熷彲浣滀负 Chip 鐨勫閫変綅锛屼竴琛屾敼鍔ㄥ嵆鍙縼绉汇€?4. **API Key 涓嶇洿鎺ヨ `ctx.config.model`**锛欴SH 鐨?Key 鐢?`credentials` 鏈嶅姟绠＄悊锛堣缃啋妯″瀷椤靛啓鍏?`.credentials.yaml`锛夛紝鎻掍欢 `credentials.resolve('<ENV_NAME>')` 璇诲彇銆乪nv 鍏滃簳銆?5. **閭欢閫氱煡**锛氭湰鎻掍欢瀹炵幇 Webhook锛堝惈绛惧悕锛夈€傞偖浠跺彲浣滀负 webhook 鐨勬帴鏀剁锛堝閫氳繃閭欢缃戝叧锛夛紝涓嶅唴缃?SMTP銆?6. 缁勪欢 API锛歝lient 鎻掍欢瀵煎嚭 `name/inject/apply`锛岀敤 `ctx.slots.inject(slot, () => ctx.slots.register({鈥, Comp))` 娉ㄥ唽锛沨ost 鎻掍欢鐢?`ctx.get('webServer')` 娉ㄥ唽璺敱锛堝惈鍚屾簮/鍥炵幆鏍￠獙銆乣ctx.effect` 鍖呰９淇濊瘉 HMR 瀹夊叏锛夆€斺€斿叏閮ㄥ鐓х湡瀹炴簮鐮佸疄鐜帮紝璇﹁銆屽伐浣滃師鐞嗐€嶃€?
## 宸ヤ綔鍘熺悊

| 閮ㄥ垎 | 鏂囦欢 | 浣滅敤 |
| --- | --- | --- |
| Host 鎻掍欢 | `src/index.ts` | `apply(ctx, config)`锛氬缓 ConfigStore銆乽sage/overview memo锛?min/60s锛夈€佹敞鍐?`/plugins/dsh-usage-monitor/*` 璺敱銆乣session/event` 鐩戝惉鍋氱紦瀛樺け鏁堛€丄lertNotifier 鎺?Webhook |
| Provider 閫傞厤鍣?| `src/adapters/*.ts` | `ProviderAdapter`锛歚getBalance(apiKey)` / `getUsage(apiKey, period)` / `validateKey(apiKey)`锛涚粺涓€ `httpRequest`锛?s 瓒呮椂 脳3 閲嶈瘯锛夛紱绾В鏋愬嚱鏁扮嫭绔嬪鍑轰究浜庢祴璇?|
| 鐢ㄩ噺鎵弿 | `src/services/usage.ts` | 鍥炴斁 `sessionPersistence`锛歚request/header`锛坧rovider/model锛夆啋 `assistant/message`锛坲sage tokens锛夛紝浼氳瘽鏍囬鏉ヨ嚜 `session/title` |
| 鑱氬悎/棰勭畻/鍛婅 | `src/core/core.ts` | 绾嚱鏁帮細鎸夋棩婊氬姩銆乨ate脳provider脳model 琛屻€佷細璇濊銆侀绠楄瘎浼?`evaluateAlert`銆佽揣甯?Token 鏍煎紡鍖?|
| 鍙傝€冧环浼扮畻 | `src/core/pricing.ts` | 鍐呯疆 USD/1M 浠风洰锛堝彲瑕嗙洊锛夛紝鍙粰銆屼及绠椼€嶆爣娉紝缁濅笉鍐掑厖璐﹀崟 |
| CSV / 鍥捐〃 | `src/core/csv.ts`銆乣src/core/chart.ts` | BOM + 寮曞彿杞箟锛汼VG 鎶樼嚎鍑犱綍 |
| Browser bundle | `src/client/*` | `index.tsx` 娉ㄥ唽 3 涓彃妲?+ 娉ㄥ叆鏍峰紡锛沗store.ts` 鍗曚竴杞 + toast 鐘舵€侊紱`components.tsx` 闈㈡澘锛堟瑙?鏄庣粏/璁剧疆锛夈€佽姱鐗囥€佽Е鍙戞寜閽紱鏁版嵁缁忓悓婧?fetch |
| 缁勫悎灞?| `cordis.patch.yml` | bundle 琛ヤ竵锛氬崟琛?`id/name` 鎻掑叆 host 缁勫悎锛沜lient 鍗婂尯鐢?`dsh.client` 娓呭崟琚?client-modules 鎵弿杩?web 寮曞鍥?|

娴忚鍣?bundle 閬靛惊 DSH 鍗忚 `window.__ModuleLoader__.load({ id, factory: (require) => 鈥?})`锛岃繍琛屾椂澶栭儴渚濊禆鍙湁 `react` / `react/jsx-runtime`锛堢敱 profile 鎻愪緵锛夈€傛瀯寤烘棤闇€ esbuild锛歚scripts/build.mjs` 鐢?tsc 鍙?program锛坔ost ESM + client CJS staging锛夌紪璇戯紝鍐嶇敱涓€涓?~50 琛岀殑鎷兼帴鍣ㄦ妸 client CJS 妯″潡娉ㄥ唽琛ㄥ寘杩?loader 闂寘銆?
## 寮€鍙?
```sh
npm install          # devDeps锛歵ypescript / @types/node / @types/react / react
npm run typecheck    # 鍙?program 绫诲瀷妫€鏌?npm run build        # 浜у嚭 lib/index.js + lib/client.js锛? lib/types锛?npm test             # node --test锛歝ore / adapters 瑙ｆ瀽 / host 璺敱鍐掔儫锛堜細鍐欑郴缁熶复鏃剁洰褰曪級
npm run verify       # 绂荤嚎鍐掔儫锛歨ost+client 浜х墿鍗忚涓庣函鍑芥暟涓嶅彉寮?npm pack             # 鐢熸垚鍙垎鍙?dsh-usage-monitor-0.1.0.tgz
```

鐩綍缁撴瀯锛?
```
src/
  core/         绾€昏緫锛坈ore.ts / pricing.ts / csv.ts / chart.ts锛夆€?host 涓?client 鍏变韩锛屽弻 program 缂栬瘧
  adapters/     ProviderAdapter 鎺ュ彛 + http(瓒呮椂/閲嶈瘯) + 6 涓?Provider + 娉ㄥ唽琛?  services/     keys 瑙ｆ瀽 / config-store(JSON 鎸佷箙鍖? / usage 鎵弿 / monitor 缁勮 / alerts(webhook)
  host/         memo / wire(trust-fence, json, body) 
  context.ts    host 渚х粨鏋勫寲鏈嶅姟闈紙涓嶄緷璧?@deepseek-ai 绫诲瀷鍖咃級
  index.ts      host 鍏ュ彛
  client/       api / store / style / components / index.tsx锛堟祻瑙堝櫒鍗婂尯锛?scripts/        build.mjs锛坱sc 鍙?program + client bundle 鎷兼帴锛? verify.mjs
test/           node --test 鍗曟祴涓庤矾鐢卞啋鐑?lib/            棰勬瀯寤轰骇鐗╋紙闅忓寘鍒嗗彂锛屽彲鐩存帴 dsh plugin add锛?cordis.patch.yml
```

濡傞渶鍙戝竷鍒扮ぞ鍖?hub锛氬厛 `git init` 寤轰粨骞舵寜 dsh-plugin 瑙勮寖鍦?`dsh.plugin.json`/catalog 鐧昏锛堟湰椤圭洰褰撳墠涓烘簮鐮?+ 棰勬瀯寤哄寘褰㈡€侊紝鏈寘鍚?hub 鍏冩暟鎹級銆?
## Troubleshooting

| 鐜拌薄 | 澶勭悊 |
| --- | --- |
| 闈㈡澘鏄剧ず銆岀己 API Key銆?| 鍦ㄣ€岃缃?鈫?妯″瀷銆嶄负瀵瑰簲 Provider 濉啓 Key锛堟垨璁剧幆澧冨彉閲忥級鍚庣偣鍒锋柊 |
| 鏌?Provider 鏄剧ず銆屾棤浣欓鎺ュ彛銆?| 璇ュ巶鍟嗕笉瀵?API Key 鎻愪緵浣欓鎺ュ彛锛堣涓婅〃锛夛紱鍙厤缃嚜瀹氫箟 `balanceUrl`锛堜唬鐞?涓浆锛夛紝鎴栧彧鍏虫敞鏃ュ織鐢ㄩ噺 |
| 娌℃湁鏁版嵁 | 鐢ㄩ噺鏉ヨ嚜 DSH 浼氳瘽鏃ュ織锛氶渶瑕佸瓨鍦ㄥ甫 `request/header`+`assistant/message` 鐨勪簨浠讹紱鍒氬畨瑁呭悗鍙湁瀹夎涔嬪悗鐨勭敤閲忥紙閲嶅惎 DSH 浠ュ畬鎴?bundle 鎸傝浇锛?|
| 淇敼 `lib/client.js` 鍚庝笉鐢熸晥 | 閲嶅惎 `dsh web` 閲嶆柊鐢熸垚寮曞鍝堝笇锛坄rev`锛夛紝鍐嶅己鍒跺埛鏂伴〉闈?|
| 鏃犳硶鍚姩 / 鏈嶅姟绛夊緟 | 鏈彃浠?`inject: []`锛屼笉浼氬洜鏈嶅姟缂哄け闃诲锛涜嫢鐣岄潰瀹屽叏鏃犲彉鍖栵紝妫€鏌?`dsh plugin list` 涓庣粍鍚堟爲鏄惁鍑虹幇 `dsh-usage-monitor` 琛?|
| 鑺辫垂鍒楁槸浼扮畻 | 鍐呯疆鍙傝€冧环浠呰鐩栧父瑙佹ā鍨嬶紱缂哄け妯″瀷鏄剧ず銆屸€斻€嶏紝鍙€氳繃閰嶇疆 `pricing` 琛ュ厖 |

## DeepSeek 官网实际消费同步（新增）

官网 `platform.deepseek.com/usage` 没有开放 API：官方只公开 `GET /user/balance`，
用量页走的是**登录态私有接口**。本插件因此新增了一条独立数据源，把官网账单口径的
消费同步到面板里：

| 数据 | 接口（私有，随时可能变更） | 认证 |
| --- | --- | --- |
| 钱包余额 / 本月汇总 | `GET /api/v0/users/get_user_summary` | userToken |
| 逐日 token（按模型） | `GET /api/v0/usage/amount?month=&year=` | userToken |
| 逐日消费 | `GET /api/v0/usage/cost?month=&year=` | userToken |

### 配置（手动粘贴 userToken）

1. 浏览器登录 platform.deepseek.com；
2. 打开控制台执行 `JSON.parse(localStorage.getItem('userToken')).value`；
3. 打开面板「预算与告警」→「DeepSeek 官网实际消费同步」，粘贴并保存。

userToken 只写入本机 `config.json`（与 webhook secret 同级对待），**GET /config 永远
回传空字符串**；插件不会读取浏览器数据，也不会把 token 发往除 platform.deepseek.com
以外的任何地址。登录态过期时状态会变成「登录态失效」，重新粘贴即可。

### 展示口径

- 概览页与 DeepSeek 卡片：今日 / 本月 / 累计消费（平台币种，默认 CNY）+ 平台余额；
- 「平台消费」标签页：逐日消费趋势、本月按模型拆分（token / 消费 / 占比）、逐月消费；
- 与原有的「估算花费（USD 参考价）」是两条独立口径：估算来自 DSH 会话日志，实际来自官网账单。

### 实现要点

| 文件 | 作用 |
| --- | --- |
| `src/adapters/deepseek-platform.ts` | 私有接口客户端 + 纯解析函数（容错 code/biz_code/数组容器、未知 token 类型） |
| `src/services/platform.ts` | 组装 `PlatformSpend`；已结束月份落盘 `platform-months.json`，逐月回溯到账号起点后不再重复探测 |
| `GET /plugins/dsh-usage-monitor/platform` | 平台数据快照（`?refresh=1` 强制同步）；`/overview` 每请求附带最新快照 |

注意：接口按 **UTC** 切分日桶，与本地自然日可能相差几小时；金额为平台账单口径。
首次同步会逐月回溯（默认最多 36 个月，可在设置里调整），之后每次只请求当月与上月。

## 兼容性（Web / 桌面壳 / 官方桌面端）

本插件只使用 dsh 的**公开插件契约**，不 import 任何 `@deepseek-ai/dsh-*` 内部包，因此在同契约的宿主上应当直接可用。

### 已验证的宿主

| 宿主 | 版本 | 状态 |
| --- | --- | --- |
| DSH Desktop（社区 Electron 壳，本机在跑） | harness 0.1.5-rc.2 | ✅ 实际运行验证 |
| 官方 `@deepseek-ai/dsh-desktop` | 0.1.6-alpha.2（master） | ✅ 契约逐项代码核对 |
| CLI + 浏览器（`dsh web`） | 同一套 harness | ✅ 相同 profile/bundle 机制 |

### 依赖的宿主契约

| 契约 | 用途 | 失效表现 |
| --- | --- | --- |
| `dsh.bundle.patch` | bundle 插件层 | 插件完全不加载 |
| `dsh.client.platform = "web"` | 浏览器半边；**必填且只接受 "web"** | 见下方「坑」：整个客户端模块图组合失败 |
| slot `conversation.session.header.utilities` | 顶栏余额芯片 | 芯片不显示，其余功能仍在 |
| slot `shell.overlay` | 面板 + 告警弹窗 | 面板不显示 |
| slot `sidebar.footer.action` | 侧栏入口按钮 | 入口按钮不显示 |
| 服务 `webServer` | 挂载本地 JSON API | 面板显示「尚未加载到数据」 |
| 服务 `credentials` / `sessionPersistence` / `agentDefaultModel` | 读 Key / 会话日志 / 当前模型 | 分别降级为环境变量 / 空统计 / 无当前模型提示 |

以上服务**全是软依赖**：插件不声明 `inject: ['webServer']`，而是启动时打印一行自检，并在服务晚挂载时自动补挂路由、清掉过期缓存：

```
[dsh-usage-monitor] contract check (apply) present=[webServer httpServer] missing=[credentials sessionPersistence agentDefaultModel]
```

排查第一步就看这行：`missing` 里若出现 `webServer httpServer`，说明该宿主的服务名变了（把该行日志反馈回来即可适配）。

### 在官方桌面端上安装

官方桌面端是「完整 dsh Web 应用的 Electron 外壳」，用同一个 Web Plugin Manager，但 profile 是 `$DSH_HOME/profiles/desktop` —— 与 `web` 的执行包、插件激活状态、锁文件**相互独立**（sessions / settings / credentials / storage 仍共享 `$DSH_HOME`）。因此要**重新装一次**：

```sh
dsh plugin --profile desktop add <本目录绝对路径 | github:owner/repo#commit | npm 包名>
```

或直接用侧边栏 **Plugins** 页面安装，装完重启。

### 一个会连累整个界面的坑（已加测试守护）

`dsh.client` 只要存在，`platform` 就必须是字符串，且只有 `"web"` 会被受理：

- 留 `{ "client": {} }` → 组合阶段抛错 `dsh.client.platform must be a string`，`client-modules` 服务构造失败，**index.html 一个客户端模块都不会注入**，所有插件的浏览器界面一起失效；
- 如果确实想要「只保留 host 半边」，应**整个删掉 `client` 键**（静默跳过），而不是留空对象。

`test/host.test.mjs` 已有断言守住这条：`dsh.client.platform === "web"`，且 `inject` 必须是字符串数组。

### 为什么不声明 harness 版本区间

生态里常见 `"@deepseek-ai/dsh-client-ui-slots": "^0.1.5-rc.1"` 这类 peer 声明，但 semver 的预发布规则会让 `^0.1.5-rc.1` **拒绝 `0.1.6-alpha.2`**（比较符的 major.minor.patch 元组不匹配），在版本跳跃的宿主上反而导致安装失败。本插件因此不卡 `@deepseek-ai/dsh-*` 的硬版本范围，改用运行时自检日志 + 本文档说明目标版本。

## License

MIT
